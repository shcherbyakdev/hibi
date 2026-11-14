import { check, index, pgTable, smallint, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { syncColumns } from "./sync";

// Something worked toward day after day. Progress isn't stored: it's the
// goal's items (items.goal_id) counted by the local day of done_at.
export const goals = pgTable(
  "goals",
  {
    ...syncColumns(),
    name: text("name").notNull(),
    notes: text("notes").notNull().default(""),
    // A tone key (features/boards/tone.ts), like boards.icon.
    icon: text("icon"),
    // Days a week to work on it.
    weeklyTarget: smallint("weekly_target").notNull().default(5),
    sortKey: text("sort_key").notNull(),
  },
  (t) => [
    index("goals_user_synced_idx").on(t.userId, t.syncedAt),
    check("goals_name_len", sql`char_length(${t.name}) between 1 and 120`),
    check("goals_notes_len", sql`char_length(${t.notes}) <= 20000`),
    check("goals_weekly_target_range", sql`${t.weeklyTarget} between 1 and 7`),
  ],
);
