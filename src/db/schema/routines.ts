import { check, foreignKey, index, pgTable, smallint, text, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { syncColumns } from "./sync";
import { goals } from "./goals";

// A step that comes back: each day it's due, the client makes that day's
// copy as an ordinary item (items.routine_id). features/routines/.
export const routines = pgTable(
  "routines",
  {
    ...syncColumns(),
    title: text("title").notNull(),
    priority: smallint("priority").notNull().default(0),
    goalId: uuid("goal_id"),
    // Weekday bitmask: bit 0 = Sunday … bit 6 = Saturday; 127 = every day.
    days: smallint("days").notNull().default(127),
  },
  (t) => [
    index("routines_user_synced_idx").on(t.userId, t.syncedAt),
    unique("routines_id_owner_key").on(t.id, t.userId),
    // Owner-scoped: FKs skip RLS, so (goal_id, user_id) keeps the link inside
    // one owner. Deleting the goal clears goal_id only (SET NULL (goal_id) in
    // migration 0013; Drizzle can't express the column list).
    foreignKey({ name: "routines_goal_owner_fk", columns: [t.goalId, t.userId], foreignColumns: [goals.id, goals.userId] }).onDelete("set null"),
    index("routines_goal_id_idx").on(t.goalId),
    check("routines_title_len", sql`char_length(${t.title}) between 1 and 500`),
    check("routines_priority_range", sql`${t.priority} between 0 and 4`),
    check("routines_days_range", sql`${t.days} between 1 and 127`),
  ],
);
