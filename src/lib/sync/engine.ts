import { SYNCED_TABLES, type LocalDb, type SyncedTable } from "./db";
import { TransientError, type PullFrom, type RowError, type SyncRow, type SyncTransport } from "./transport";

export type SyncPhase = "idle" | "syncing" | "offline";
export type Rejection = { table: SyncedTable; id: string; error: RowError };

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

const newer = (a: { updated_at: string }, b: { updated_at: string }) => Date.parse(a.updated_at) > Date.parse(b.updated_at);

/** Background sync between the local db and a server, through a transport
    (transport.ts; docs/PLAN.md §2). Push: drain the outbox as upserts; the
    server does last-write-wins. A row the server refuses (RowError) is
    rejected instead of blocking the queue; anything else (TransientError)
    is retried with backoff. Pull: rows whose synced_at passed the cursor,
    merged LWW so an unpushed local edit is never overwritten. Hints only
    say "something changed" and trigger a pull; they carry no data. */
export function createSyncEngine({
  db,
  transport,
  onReject = (r) => console.error(`[sync] ${r.table} ${r.id} rejected:`, r.error),
}: {
  db: LocalDb;
  transport: SyncTransport;
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
  let unsubscribe: (() => void) | undefined;
  let catchUpTimer: ReturnType<typeof setTimeout> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  async function reject(table: SyncedTable, row: SyncRow, error: RowError) {
    // Put the server's version back (or drop a row the server never had),
    // so the local db stops showing something that will never sync. A failed
    // read throws TransientError: "couldn't ask" must never delete.
    const data = await transport.get(table, row.id);
    const t = db.table(table);
    await (data ? t.put(data) : t.delete(row.id));
    onReject({ table, id: row.id, error });
  }

  async function pushTable(table: SyncedTable, ids: string[]) {
    const rows = (await db.table<SyncRow, string>(table).bulkGet(ids)).filter((r) => r !== undefined);
    if (!rows.length) return;
    if (!(await transport.upsert(table, rows))) return;
    // One bad row fails the whole batch; find it row by row.
    for (const row of rows) {
      const error = await transport.upsert(table, [row]);
      if (error) await reject(table, row, error);
    }
  }

  async function push() {
    for (;;) {
      // The whole outbox at once, so FK order (parents' tables first) holds
      // across everything queued — paging it could send a child whose parent
      // sits on a later page, and the server would refuse it (23503).
      // ponytail: entries are {table, id} only; fine to ~100k queued writes.
      const entries = await db.outbox.orderBy("seq").toArray();
      if (!entries.length) return;
      for (const table of SYNCED_TABLES) {
        const ids = [...new Set(entries.filter((e) => e.table === table).map((e) => e.id))];
        for (let i = 0; i < ids.length; i += PAGE) await pushTable(table, ids.slice(i, i + PAGE));
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
      // First page: overlap behind the cursor. Next pages: keyset, so a burst
      // of rows sharing one synced_at can't loop the pager.
      const from: PullFrom = after ? { after } : { since: new Date(Date.parse(cursor) - OVERLAP_MS).toISOString() };
      const data = await transport.pull(table, from, PAGE);
      if (!data.length) return;

      const t = db.table<SyncRow, string>(table);
      await db.transaction("rw", t, db.meta, async () => {
        const locals = await t.bulkGet(data.map((r) => r.id));
        // A local row newer than the server's is an unpushed edit: keep it.
        await t.bulkPut(data.filter((r, i) => !locals[i] || !newer(locals[i], r)));
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
      // Stopped mid-run (sign-out deletes the db under it): nothing to retry.
      if (stopped) return;
      if (!(e instanceof TransientError) && !(e instanceof TypeError)) console.error("[sync]", e);
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
      unsubscribe = transport.subscribe(
        () => sync({ push: false }),
        () => {
          sync({ push: false });
          clearTimeout(catchUpTimer);
          catchUpTimer = setTimeout(() => sync({ push: false }), CATCH_UP_MS);
        },
      );
      heartbeat = setInterval(() => sync({ push: false }), HEARTBEAT_MS);
    },
    stop() {
      stopped = true;
      clearTimeout(retryTimer);
      clearTimeout(catchUpTimer);
      clearInterval(heartbeat);
      unsubscribe?.();
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
