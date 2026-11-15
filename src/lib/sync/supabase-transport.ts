import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { SYNCED_TABLES, type SyncedTable } from "./db";
import { TransientError, type RowError, type SyncRow, type SyncTransport } from "./transport";

/** Postgres refused the row itself (constraint, bad value, RLS): a RowError.
    Anything else (network, auth refresh, 5xx, unknown) is transient. */
const isRowError = (e: PostgrestError) => /^2[23]/.test(e.code) || e.code === "42501";
const toRowError = (e: PostgrestError): RowError => ({ code: e.code, message: e.message });

/** The hosted edition's transport: PostgREST for rows (RLS scopes them to
    the signed-in user; the sync_stamp trigger stamps synced_at and drops
    older writes), Realtime postgres_changes for hints. */
export function createSupabaseTransport(supabase: SupabaseClient, userId: string): SyncTransport {
  // A union of table names defeats supabase-js typing, so it talks to
  // PostgREST untyped. Rows are typed locally.
  const rest = (table: SyncedTable) => supabase.from(table as string);

  return {
    async upsert(table, rows) {
      const { error } = await rest(table).upsert(rows);
      if (!error) return null;
      if (isRowError(error)) return toRowError(error);
      throw new TransientError(error.message);
    },

    async get(table, id) {
      const { data, error } = await rest(table).select("*").eq("id", id).maybeSingle();
      if (error) throw new TransientError(error.message);
      return (data as SyncRow | null) ?? null;
    },

    async pull(table, from, limit) {
      let q = rest(table).select("*").order("synced_at").order("id").limit(limit);
      // Keyset paging, so a burst of rows sharing one synced_at can't loop
      // the pager.
      q =
        "since" in from
          ? q.gt("synced_at", from.since)
          : q.or(`synced_at.gt."${from.after.synced_at}",and(synced_at.eq."${from.after.synced_at}",id.gt.${from.after.id})`);
      const { data, error } = await q;
      if (error) throw new TransientError(error.message);
      return data as SyncRow[];
    },

    subscribe(onChange, onReady) {
      // Unique topic: StrictMode's mount/unmount/mount must not reuse a
      // channel whose removal is still in flight.
      const channel = supabase.channel(`sync:${userId}:${crypto.randomUUID()}`);
      for (const table of SYNCED_TABLES) {
        channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` }, onChange);
      }
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") onReady();
      });
      return () => void supabase.removeChannel(channel);
    },
  };
}
