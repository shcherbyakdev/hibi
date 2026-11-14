import { check, date, index, pgTable, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { syncColumns } from "./sync";
import { boardColumns, boards } from "./boards";
import { goals } from "./goals";

import { ITEM_STATUSES, PLAN_SCOPES } from "../enums";

// One table for everything: the planner is a view by plan_scope/plan_date,
// a board is a view by board_id. An item can be on a board AND planned.
export const items = pgTable(
  "items",
  {
    ...syncColumns(),
    title: text("title").notNull(),
    notes: text("notes").notNull().default(""),
    status: text("status", { enum: ITEM_STATUSES }).notNull().default("todo"),
    // 0 = none, 1 = urgent … 4 = low (Linear's order).
    priority: smallint("priority").notNull().default(0),
    planScope: text("plan_scope", { enum: PLAN_SCOPES }),
    // The day, the first day of the week, or the 1st of the month.
    planDate: date("plan_date"),
    boardId: uuid("board_id").references(() => boards.id, { onDelete: "set null" }),
    columnId: uuid("column_id").references(() => boardColumns.id, { onDelete: "set null" }),
    // ponytail: like board_id (0001), this FK bypasses RLS, so a crafted write
    // could point at another user's goal id. It leaks nothing (that goal stays
    // invisible); add composite (id, user_id) FKs if goals are ever shared.
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    sortKey: text("sort_key").notNull(),
    doneAt: timestamp("done_at", { withTimezone: true }),
  },
  (t) => [
    index("items_user_synced_idx").on(t.userId, t.syncedAt),
    index("items_board_id_idx").on(t.boardId),
    index("items_column_id_idx").on(t.columnId),
    index("items_goal_id_idx").on(t.goalId),
    check("items_title_len", sql`char_length(${t.title}) between 1 and 500`),
    check("items_notes_len", sql`char_length(${t.notes}) <= 20000`),
    check("items_status_valid", sql`${t.status} in ('todo', 'doing', 'done', 'dropped')`),
    check("items_priority_range", sql`${t.priority} between 0 and 4`),
    check("items_scope_valid", sql`${t.planScope} in ('day', 'week', 'month')`),
    // Scope and date come together or not at all.
    check("items_plan_pair", sql`(${t.planScope} is null) = (${t.planDate} is null)`),
    // A month plan is pinned to the 1st. (Weeks aren't constrained: the
    // week-start day is a user setting.)
    check(
      "items_plan_month_aligned",
      sql`${t.planScope} is distinct from 'month' or extract(day from ${t.planDate}) = 1`,
    ),
  ],
);
