import { check, index, integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { syncColumns } from "./sync";
import { items } from "./items";

// One timer session on a task. Running while ended_at is null; a task's
// tracked time is the sum of its sessions, so "continue later" is simply a
// new session. planned_seconds marks a pomodoro: the session counts at most
// that long and is closed at started_at + planned_seconds.
export const timeEntries = pgTable(
  "time_entries",
  {
    ...syncColumns(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    plannedSeconds: integer("planned_seconds"),
  },
  (t) => [
    index("time_entries_user_synced_idx").on(t.userId, t.syncedAt),
    index("time_entries_item_id_idx").on(t.itemId),
    check("time_entries_order", sql`${t.endedAt} is null or ${t.endedAt} >= ${t.startedAt}`),
    check("time_entries_planned_range", sql`${t.plannedSeconds} is null or ${t.plannedSeconds} between 60 and 14400`),
  ],
);
