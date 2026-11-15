import type { SyncedTable } from "./db";
import { TransientError, type PullFrom, type RowError, type SyncRow, type SyncTransport } from "./transport";

type Op = "upsert" | "get" | "pull";

/** An in-memory sync server: the reference for what a transport must do
    (transport.contract.ts) and a fast stand-in in engine unit tests. Behaves
    like the hosted one: a batch is all-or-nothing and shares one synced_at
    (Postgres now() is per transaction), and an older updated_at is dropped
    (sync_stamp). `refuse` plays the database's constraints. */
export function createMemoryServer({ refuse = () => null }: { refuse?: (table: SyncedTable, row: SyncRow) => RowError | null } = {}) {
  const store = new Map<SyncedTable, Map<string, SyncRow>>();
  const tableOf = (t: SyncedTable) => store.get(t) ?? store.set(t, new Map()).get(t)!;
  const clients = new Set<{ onChange: () => void }>();
  const failing = new Set<Op>();
  let clock = 0;
  const stamp = () => new Date((clock = Math.max(Date.now(), clock + 1))).toISOString();
  const check = (op: Op) => {
    if (failing.delete(op)) throw new TransientError(`memory server: ${op} failed`);
  };
  const copy = (r: SyncRow) => structuredClone(r);

  function transport(): SyncTransport {
    const self = { onChange: () => {} };
    return {
      async upsert(table, rows) {
        check("upsert");
        for (const r of rows) {
          const err = refuse(table, r);
          if (err) return err;
        }
        const t = tableOf(table);
        const at = stamp();
        for (const r of rows) {
          const old = t.get(r.id);
          if (old && Date.parse(r.updated_at) < Date.parse(old.updated_at)) continue;
          t.set(r.id, { ...copy(r), synced_at: at });
        }
        for (const c of clients) if (c !== self) c.onChange();
        return null;
      },
      async get(table, id) {
        check("get");
        const r = tableOf(table).get(id);
        return r ? copy(r) : null;
      },
      async pull(table, from: PullFrom, limit) {
        check("pull");
        const key = (r: { synced_at: string; id: string }) => `${r.synced_at}|${r.id}`;
        const past = (r: SyncRow) => ("since" in from ? r.synced_at > from.since : key(r) > key(from.after));
        return [...tableOf(table).values()].filter(past).sort((x, y) => (key(x) < key(y) ? -1 : 1)).slice(0, limit).map(copy);
      },
      subscribe(onChange, onReady) {
        self.onChange = onChange;
        clients.add(self);
        queueMicrotask(onReady);
        return () => void clients.delete(self);
      },
    };
  }

  return {
    transport,
    rows: (table: SyncedTable) => [...tableOf(table).values()].map(copy),
    /** The next call of this kind throws TransientError (an outage). */
    failNext: (op: Op) => void failing.add(op),
  };
}
