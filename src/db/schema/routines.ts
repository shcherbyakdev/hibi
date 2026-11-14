import { check, index, pgTable, smallint, text, uuid } from "drizzle-orm/pg-core";
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
    // ponytail: like items.goal_id, this FK bypasses RLS; leaks nothing.
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    // Weekday bitmask: bit 0 = Sunday … bit 6 = Saturday; 127 = every day.
    days: smallint("days").notNull().default(127),
  },
  (t) => [
    index("routines_user_synced_idx").on(t.userId, t.syncedAt),
    index("routines_goal_id_idx").on(t.goalId),
    check("routines_title_len", sql`char_length(${t.title}) between 1 and 500`),
    check("routines_priority_range", sql`${t.priority} between 0 and 4`),
    check("routines_days_range", sql`${t.days} between 1 and 127`),
  ],
);
