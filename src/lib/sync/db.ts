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
    // v6: boards folded into goals (migration 0011). Apply the same fold to
    // local items — goal from the board, status from the column — so a push
    // of a local copy can't undo the server's, then strip the gone fields
    // so a push never sends columns the server no longer has. Dropped
    // tables are still readable here (Dexie deletes them after upgraders).
    // Stale outbox entries for them are skipped by the engine and cleared.
    this.version(6)
      .stores({
        boards: null,
        board_columns: null,
        items: "id, [plan_scope+plan_date], status, goal_id, routine_id",
      })
      .upgrade(async (tx) => {
        const columns = new Map(
          (await tx.table("board_columns").toArray())
            .filter((c) => !c.deleted_at)
            .map((c) => [c.id as string, String(c.name).trim().toLowerCase()]),
        );
        await tx
          .table("items")
          .toCollection()
          .modify((i: Record<string, unknown>) => {
            if (i.board_id) Object.assign(i, foldBoardItem(i, columns.get(i.column_id as string)));
            delete i.board_id;
            delete i.column_id;
          });
      });
  }
}

/** Migration 0011's fold for one board item, given its live column's
    lowercased name: its own goal wins, else the board's (same id); a "done"
    column marks it done (keeping or stamping done_at), "doing" moves a todo
    to doing; dropped tasks stay dropped. Exported for the test. */
export function foldBoardItem(i: Record<string, unknown>, column: string | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = { goal_id: i.goal_id ?? i.board_id };
  if (i.status === "dropped") return out;
  if (column === "done") Object.assign(out, { status: "done", done_at: i.done_at ?? i.updated_at });
  else if (column === "doing" && i.status === "todo") out.status = "doing";
  return out;
}

/** One database per user, so a second account on this browser never sees
    the first one's rows. */
export const localDbFor = (userId: string) => new LocalDb(`todo-${userId}`);
