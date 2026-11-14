import Dexie, { type Table } from "dexie";
import type { Tables } from "@/db/database.types";
import type { GoalLayout, ItemStatus, PlanScope } from "@/db/enums";

// Local rows are exactly the server's rows (snake_case, ISO strings): no
// mapping layer between IndexedDB and PostgREST.
export type Item = Omit<Tables<"items">, "status" | "plan_scope"> & { status: ItemStatus; plan_scope: PlanScope | null };
export type TimeEntry = Tables<"time_entries">;
export type Goal = Omit<Tables<"goals">, "layout"> & { layout: GoalLayout };
export type Routine = Tables<"routines">;

/** Push order = FK order: a goal before its routines and items, a routine
    before its copies, an item before its time entries. */
export const SYNCED_TABLES = ["goals", "routines", "items", "time_entries"] as const;
export type SyncedTable = (typeof SYNCED_TABLES)[number];
export type RowOf<T extends SyncedTable> = { goals: Goal; routines: Routine; items: Item; time_entries: TimeEntry }[T];

/** One per local write; drained by the engine. Only the id is queued: the
    push sends the row's CURRENT state, so ten edits cost one upsert. */
export type OutboxEntry = { seq?: number; table: SyncedTable; id: string };
export type Meta = { key: string; value: string };

export class LocalDb extends Dexie {
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
    // v6: boards folded into goals. Drop their tables and strip the gone
    // fields from local items, so a push never sends columns the server
    // no longer has. Stale outbox entries for the dropped tables are
    // skipped by the engine (not in SYNCED_TABLES) and cleared with the rest.
    this.version(6)
      .stores({
        boards: null,
        board_columns: null,
        items: "id, [plan_scope+plan_date], status, goal_id, routine_id",
      })
      .upgrade((tx) =>
        tx
          .table("items")
          .toCollection()
          .modify((i: Record<string, unknown>) => {
            delete i.board_id;
            delete i.column_id;
          }),
      );
  }
}

/** One database per user, so a second account on this browser never sees
    the first one's rows. */
export const localDbFor = (userId: string) => new LocalDb(`todo-${userId}`);
