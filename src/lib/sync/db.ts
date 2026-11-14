import Dexie, { type Table } from "dexie";
import type { Tables } from "@/db/database.types";
import type { BoardLayout, ItemStatus, PlanScope } from "@/db/enums";

// Local rows are exactly the server's rows (snake_case, ISO strings): no
// mapping layer between IndexedDB and PostgREST.
export type Item = Omit<Tables<"items">, "status" | "plan_scope"> & { status: ItemStatus; plan_scope: PlanScope | null };
export type Board = Omit<Tables<"boards">, "layout"> & { layout: BoardLayout };
export type BoardColumn = Tables<"board_columns">;
export type TimeEntry = Tables<"time_entries">;
export type Goal = Tables<"goals">;
export type Routine = Tables<"routines">;

/** Push order = FK order: a column's board before the column, an item
    before its time entries, a goal before the items linked to it, a routine before its copies. */
export const SYNCED_TABLES = ["boards", "board_columns", "goals", "routines", "items", "time_entries"] as const;
export type SyncedTable = (typeof SYNCED_TABLES)[number];
export type RowOf<T extends SyncedTable> = { boards: Board; board_columns: BoardColumn; goals: Goal; routines: Routine; items: Item; time_entries: TimeEntry }[T];

/** One per local write; drained by the engine. Only the id is queued: the
    push sends the row's CURRENT state, so ten edits cost one upsert. */
export type OutboxEntry = { seq?: number; table: SyncedTable; id: string };
export type Meta = { key: string; value: string };

export class LocalDb extends Dexie {
  boards!: Table<Board, string>;
  board_columns!: Table<BoardColumn, string>;
  items!: Table<Item, string>;
  time_entries!: Table<TimeEntry, string>;
  goals!: Table<Goal, string>;
  routines!: Table<Routine, string>;
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
    // v3: timer sessions.
    this.version(3).stores({
      time_entries: "id, item_id",
    });
    // v4: goals, and items by goal.
    this.version(4).stores({
      goals: "id",
      items: "id, [plan_scope+plan_date], board_id, status, goal_id",
    });
    // v5: routines, and items by routine.
    this.version(5).stores({
      routines: "id",
      items: "id, [plan_scope+plan_date], board_id, status, goal_id, routine_id",
    });
  }
}

/** One database per user, so a second account on this browser never sees
    the first one's rows. */
export const localDbFor = (userId: string) => new LocalDb(`todo-${userId}`);
