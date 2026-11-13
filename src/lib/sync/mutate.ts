import type { LocalDb, RowOf, SyncedTable } from "./db";

type SyncFields = "user_id" | "created_at" | "updated_at" | "synced_at" | "deleted_at";
export type NewRow<T extends SyncedTable> = Omit<RowOf<T>, SyncFields | "id"> & { id?: string };
export type Patch<T extends SyncedTable> = Partial<Omit<RowOf<T>, SyncFields | "id">>;

/** Never pulled yet. Any server synced_at is later. */
const NEVER = "1970-01-01T00:00:00.000Z";

/** The LWW key. Strictly after the row's previous stamp, so two edits in the
    same millisecond (or a clock that stepped back) still order correctly.
    ponytail: device clocks decide LWW; a device whose clock runs far ahead
    wins ties it shouldn't. Fine for one person's devices; switch to a server
    or hybrid-logical clock if that ever bites. */
export function nextStamp(prev?: string): string {
  const floor = prev ? Date.parse(prev) + 1 : 0;
  return new Date(Math.max(Date.now(), floor)).toISOString();
}

/** Local-first writes. Each one lands in IndexedDB together with its outbox
    entry (one transaction), then pokes the engine. The UI never waits on
    the network: useLiveQuery re-renders from the local write. */
export function createMutations(db: LocalDb, userId: string, kick: () => void) {
  async function write<T extends SyncedTable>(table: T, id: string, build: (prev: RowOf<T> | undefined) => RowOf<T> | null) {
    const t = db.table<RowOf<T>, string>(table);
    const written = await db.transaction("rw", t, db.outbox, async () => {
      const row = build(await t.get(id));
      if (!row) return false;
      await t.put(row);
      await db.outbox.add({ table, id });
      return true;
    });
    if (written) kick();
  }

  return {
    insert<T extends SyncedTable>(table: T, row: NewRow<T>): Promise<string> {
      const id = row.id ?? crypto.randomUUID();
      const now = nextStamp();
      return write(table, id, () => ({ ...row, id, user_id: userId, created_at: now, updated_at: now, synced_at: NEVER, deleted_at: null }) as unknown as RowOf<T>).then(() => id);
    },

    update<T extends SyncedTable>(table: T, id: string, patch: Patch<T>): Promise<void> {
      return write(table, id, (prev) => (prev ? { ...prev, ...patch, updated_at: nextStamp(prev.updated_at) } : null));
    },

    /** Soft delete: it syncs like any edit. Reads filter deleted_at. */
    remove(table: SyncedTable, id: string): Promise<void> {
      return write(table, id, (prev) => (prev ? { ...prev, deleted_at: new Date().toISOString(), updated_at: nextStamp(prev.updated_at) } : null));
    },

    /** Undo a soft delete. */
    restore(table: SyncedTable, id: string): Promise<void> {
      return write(table, id, (prev) => (prev ? { ...prev, deleted_at: null, updated_at: nextStamp(prev.updated_at) } : null));
    },
  };
}

export type Mutations = ReturnType<typeof createMutations>;
