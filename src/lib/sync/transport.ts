import type { SyncedTable } from "./db";

/* The seam between the sync engine and a server. The engine owns the sync
   logic (outbox, FK order, LWW merge, rejection, backoff); a transport only
   moves rows. Hosted: supabase-transport.ts. Reference + tests:
   memory-transport.ts. transport.contract.ts is what every one must pass. */

export type SyncRow = { id: string; updated_at: string; synced_at: string } & Record<string, unknown>;

/** The server refused a row itself (constraint, permission): retrying can't help. */
export type RowError = { code: string; message: string };

/** Anything else (network, auth, 5xx): the engine backs off and retries. */
export class TransientError extends Error {}

export type PullFrom = { since: string } | { after: { synced_at: string; id: string } };

export interface SyncTransport {
  /** All-or-nothing batch. The server stamps synced_at and drops a row whose
      updated_at is older than the stored one. Returns null on success or the
      refusal; throws TransientError otherwise. */
  upsert(table: SyncedTable, rows: SyncRow[]): Promise<RowError | null>;
  /** The server's row, or null if it has none. Throws TransientError. */
  get(table: SyncedTable, id: string): Promise<SyncRow | null>;
  /** Rows with synced_at > since, or after the keyset (synced_at, id),
      ordered by (synced_at, id), at most `limit`. Throws TransientError. */
  pull(table: SyncedTable, from: PullFrom, limit: number): Promise<SyncRow[]>;
  /** Hints only, never data: onChange when another client wrote; onReady
      each time the channel is (re)established. Returns unsubscribe. */
  subscribe(onChange: () => void, onReady: () => void): () => void;
}
