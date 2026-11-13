import Dexie, { type Table } from "dexie";
import type { Tables } from "@/db/database.types";
import type { BoardLayout, ItemStatus, PlanScope } from "@/db/enums";

// Local rows are exactly the server's rows (snake_case, ISO strings): no
// mapping layer between IndexedDB and PostgREST.
export type Item = Omit<Tables<"items">, "status" | "plan_scope"> & { status: ItemStatus; plan_scope: PlanScope | null };
export type Board = Omit<Tables<"boards">, "layout"> & { layout: BoardLayout };
export type BoardColumn = Tables<"board_columns">;

/** Push order = FK order: a column's board must exist before the column. */
export const SYNCED_TABLES = ["boards", "board_columns", "items"] as const;
export type SyncedTable = (typeof SYNCED_TABLES)[number];
export type RowOf<T extends SyncedTable> = { boards: Board; board_columns: BoardColumn; items: Item }[T];

/** One per local write; drained by the engine. Only the id is queued: the
    push sends the row's CURRENT state, so ten edits cost one upsert. */
export type OutboxEntry = { seq?: number; table: SyncedTable; id: string };
export type Meta = { key: string; value: string };

export class LocalDb extends Dexie {
  boards!: Table<Board, string>;
  board_columns!: Table<BoardColumn, string>;
  items!: Table<Item, string>;
  outbox!: Table<OutboxEntry, number>;
  meta!: Table<Meta, string>;

  constructor(name: string) {
    super(name);
    // Only indexed fields are listed. IndexedDB skips rows whose key is
    // null, so the compound indexes cover planned / on-a-board items only.
    this.version(1).stores({
      boards: "id",
      board_columns: "id, board_id",
      items: "id, [plan_scope+plan_date], [board_id+column_id], status",
      outbox: "++seq",
      meta: "key",
    });
    // v2: a plain board_id index — the compound one skips items whose
    // column_id is null, and boards need those too ("No column").
    this.version(2).stores({
      items: "id, [plan_scope+plan_date], board_id, status",
    });
  }
}

/** One database per user, so a second account on this browser never sees
    the first one's rows. */
export const localDbFor = (userId: string) => new LocalDb(`todo-${userId}`);
