import { check, date, foreignKey, index, pgTable, smallint, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { syncColumns } from "./sync";
import { goals } from "./goals";
import { routines } from "./routines";

import { ITEM_STATUSES, PLAN_SCOPES } from "../enums";

// One table for every task: the planner is a view by plan_scope/plan_date,
// a goal is a view by goal_id. A task can belong to a goal AND be planned.
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
    goalId: uuid("goal_id"),
    // Set on a routine's daily copy (features/routines).
    routineId: uuid("routine_id"),
    sortKey: text("sort_key").notNull(),
    doneAt: timestamp("done_at", { withTimezone: true }),
  },
  (t) => [
    index("items_user_synced_idx").on(t.userId, t.syncedAt),
    unique("items_id_owner_key").on(t.id, t.userId),
    // Owner-scoped links (see routines.ts): SET NULL (goal_id) / (routine_id)
    // in migration 0013.
    foreignKey({ name: "items_goal_owner_fk", columns: [t.goalId, t.userId], foreignColumns: [goals.id, goals.userId] }).onDelete("set null"),
    foreignKey({ name: "items_routine_owner_fk", columns: [t.routineId, t.userId], foreignColumns: [routines.id, routines.userId] }).onDelete("set null"),
    index("items_goal_id_idx").on(t.goalId),
    index("items_routine_id_idx").on(t.routineId),
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
