import type { PostgrestError, RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { SYNCED_TABLES, type LocalDb, type SyncedTable } from "./db";

export type SyncPhase = "idle" | "syncing" | "offline";
export type Rejection = { table: SyncedTable; id: string; error: PostgrestError };

const PAGE = 500;
/** Pull re-reads this far behind the cursor: synced_at is now() at
    transaction START, so a slow transaction can commit rows older than
    ones already pulled. Rows are idempotent, re-reading is free. */
const OVERLAP_MS = 5_000;
const MAX_BACKOFF_MS = 30_000;
/** Realtime is a hint, not a guarantee: a change can slip past while a
    subscription warms up or reconnects. A catch-up pull shortly after each
    subscribe plus a slow heartbeat bound how stale a device can get. */
const CATCH_UP_MS = 3_000;
const HEARTBEAT_MS = 60_000;
const EPOCH = "1970-01-01T00:00:00.000Z";

/** Postgres refused the row itself (constraint, bad value, RLS). Retrying
    can't help, so the row is rejected instead of blocking the queue. Any
    other failure (network, auth refresh, 5xx, unknown) is retried. */
/** What the engine needs to know about a row; the rest it passes through. */
type SyncRow = { id: string; updated_at: string; synced_at: string } & Record<string, unknown>;

const isRowError = (e: PostgrestError) => /^2[23]/.test(e.code) || e.code === "42501";

const newer = (a: { updated_at: string }, b: { updated_at: string }) => Date.parse(a.updated_at) > Date.parse(b.updated_at);

class Retry extends Error {}

/** Background sync between the local db and Supabase (docs/PLAN.md §2).
    Push: drain the outbox as upserts; the server's sync_stamp trigger does
    last-write-wins. Pull: rows whose synced_at passed the cursor, merged
    LWW so an unpushed local edit is never overwritten. Realtime only says
    "something changed" and triggers a pull; it carries no data we trust. */
export function createSyncEngine({
  db,
  supabase,
  userId,
  onReject = (r) => console.error(`[sync] ${r.table} ${r.id} rejected:`, r.error),
}: {
  db: LocalDb;
  supabase: SupabaseClient;
  userId: string;
  onReject?: (r: Rejection) => void;
}) {
  let phase: SyncPhase = "idle";
  const listeners = new Set<() => void>();
  const setPhase = (p: SyncPhase) => {
    if (p === phase) return;
    phase = p;
    listeners.forEach((l) => l());
  };

  let wantPush = false;
  let wantPull = false;
  let running = false;
  let stopped = false;
  let failures = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let channel: RealtimeChannel | undefined;
  let catchUpTimer: ReturnType<typeof setTimeout> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  // The engine treats all three tables alike; a union of table names defeats
  // supabase-js typing, so it talks to PostgREST untyped. Rows are typed locally.
  const rest = (table: SyncedTable) => supabase.from(table as string);

  async function reject(table: SyncedTable, row: SyncRow, error: PostgrestError) {
    // Put the server's version back (or drop a row the server never had),
    // so the local db stops showing something that will never sync.
    const { data, error: readError } = await rest(table).select("*").eq("id", row.id).maybeSingle();
    // Can't tell "server never had it" from "couldn't ask": never delete on a failed read.
    if (readError) throw new Retry(readError.message);
    const t = db.table(table);
    await (data ? t.put(data) : t.delete(row.id));
    onReject({ table, id: row.id, error });
  }

  async function pushTable(table: SyncedTable, ids: string[]) {
    const rows = (await db.table<SyncRow, string>(table).bulkGet(ids)).filter((r) => r !== undefined);
    if (!rows.length) return;
    const { error } = await rest(table).upsert(rows);
    if (!error) return;
    if (!isRowError(error)) throw new Retry(error.message);
    // One bad row fails the whole batch; find it row by row.
    for (const row of rows) {
      const res = await rest(table).upsert(row);
      if (res.error && !isRowError(res.error)) throw new Retry(res.error.message);
      if (res.error) await reject(table, row, res.error);
    }
  }

  async function push() {
    for (;;) {
      const entries = await db.outbox.orderBy("seq").limit(PAGE).toArray();
      if (!entries.length) return;
      for (const table of SYNCED_TABLES) {
        const ids = [...new Set(entries.filter((e) => e.table === table).map((e) => e.id))];
        if (ids.length) await pushTable(table, ids);
      }
      // Only what was read: edits queued meanwhile have higher seqs and stay.
      await db.outbox.where("seq").belowOrEqual(entries[entries.length - 1].seq!).delete();
    }
  }

  async function pullTable(table: SyncedTable) {
    const key = `cursor:${table}`;
    const cursor = (await db.meta.get(key))?.value ?? EPOCH;
    let after: { synced_at: string; id: string } | null = null;
    for (;;) {
      let q = rest(table).select("*").order("synced_at").order("id").limit(PAGE);
      // First page: overlap behind the cursor. Next pages: keyset, so a burst
      // of rows sharing one synced_at can't loop the pager.
      q = after
        ? q.or(`synced_at.gt."${after.synced_at}",and(synced_at.eq."${after.synced_at}",id.gt.${after.id})`)
        : q.gt("synced_at", new Date(Date.parse(cursor) - OVERLAP_MS).toISOString());
      const { data, error } = await q;
      if (error) throw new Retry(error.message);
      if (!data.length) return;

      const t = db.table<SyncRow, string>(table);
      await db.transaction("rw", t, db.meta, async () => {
        const locals = await t.bulkGet(data.map((r) => r.id));
        // A local row newer than the server's is an unpushed edit: keep it.
        await t.bulkPut((data as SyncRow[]).filter((r, i) => !locals[i] || !newer(locals[i], r)));
        const last = data[data.length - 1].synced_at;
        if (Date.parse(last) > Date.parse(cursor)) await db.meta.put({ key, value: last });
      });
      if (data.length < PAGE) return;
      after = data[data.length - 1];
    }
  }

  async function run() {
    if (running || stopped) return;
    running = true;
    setPhase("syncing");
    try {
      while (wantPush || wantPull) {
        if (wantPush) {
          wantPush = false;
          await push();
        }
        if (wantPull) {
          wantPull = false;
          for (const table of SYNCED_TABLES) await pullTable(table);
        }
      }
      failures = 0;
      setPhase("idle");
    } catch (e) {
      if (!(e instanceof Retry) && !(e instanceof TypeError)) console.error("[sync]", e);
      // Offline or failing: try everything again, backing off to 30s.
      wantPush = wantPull = true;
      setPhase("offline");
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => void run(), Math.min(MAX_BACKOFF_MS, 1000 * 2 ** failures++));
    } finally {
      running = false;
    }
  }

  function sync({ push = true, pull = true } = {}) {
    wantPush ||= push;
    wantPull ||= pull;
    clearTimeout(retryTimer);
    void run();
  }

  return {
    /** First pull (fills an empty db), push anything queued offline, then
        listen. Re-subscribing after a drop triggers a catch-up pull. */
    start() {
      stopped = false;
      sync();
      // Unique topic: StrictMode's mount/unmount/mount must not reuse a
      // channel whose removal is still in flight.
      channel = supabase.channel(`sync:${userId}:${crypto.randomUUID()}`);
      for (const table of SYNCED_TABLES) {
        channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` }, () => sync({ push: false }));
      }
      channel.subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        sync({ push: false });
        clearTimeout(catchUpTimer);
        catchUpTimer = setTimeout(() => sync({ push: false }), CATCH_UP_MS);
      });
      heartbeat = setInterval(() => sync({ push: false }), HEARTBEAT_MS);
    },
    stop() {
      stopped = true;
      clearTimeout(retryTimer);
      clearTimeout(catchUpTimer);
      clearInterval(heartbeat);
      if (channel) void supabase.removeChannel(channel);
    },
    /** After a local write. */
    kick: () => sync({ pull: false }),
    /** Focus, coming back online, a manual refresh. */
    sync,
    getPhase: () => phase,
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;
