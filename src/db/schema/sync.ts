import { sql } from "drizzle-orm";
import { timestamp, uuid } from "drizzle-orm/pg-core";

// Columns every synced table carries (docs/PLAN.md §2).
// - user_id: owner; FK to auth.users + RLS live in the SQL migration.
// - updated_at: CLIENT clock, the last-write-wins key. The sync_stamp trigger
//   drops an update whose updated_at is older than the stored row's.
// - synced_at: SERVER clock, set by the trigger on every write; the pull
//   cursor. Never written by clients.
// - deleted_at: soft delete, so deletes sync like any other edit.
export const syncColumns = () => ({
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().default(sql`auth.uid()`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
