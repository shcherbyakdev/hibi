import { check, index, pgTable, smallint, text, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { syncColumns } from "./sync";
import { GOAL_LAYOUTS } from "../enums";

// Something worked toward day after day. Progress isn't stored: it's the
// goal's items (items.goal_id) counted by the local day of done_at.
export const goals = pgTable(
  "goals",
  {
    ...syncColumns(),
    name: text("name").notNull(),
    notes: text("notes").notNull().default(""),
    // A tone key (src/lib/tone.ts).
    icon: text("icon"),
    // Days a week to work on it.
    weeklyTarget: smallint("weekly_target").notNull().default(5),
    sortKey: text("sort_key").notNull(),
    // How the goal page shows its tasks: a list, or To do / Doing / Done.
    layout: text("layout", { enum: GOAL_LAYOUTS }).notNull().default("list"),
  },
  (t) => [
    index("goals_user_synced_idx").on(t.userId, t.syncedAt),
    // Target of owner-scoped FKs: a row can only link to its owner's goals.
    unique("goals_id_owner_key").on(t.id, t.userId),
    check("goals_name_len", sql`char_length(${t.name}) between 1 and 120`),
    check("goals_notes_len", sql`char_length(${t.notes}) <= 20000`),
    check("goals_weekly_target_range", sql`${t.weeklyTarget} between 1 and 7`),
    check("goals_layout_valid", sql`${t.layout} in ('list', 'board')`),
  ],
);
