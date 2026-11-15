-- Owner-scoped links. FK checks skip RLS, so a single-column FK let a crafted
-- write point a row at another user's goal / routine / item (no leak, but a
-- cross-owner link and an existence probe). Each link now carries user_id:
-- (goal_id, user_id) -> goals(id, user_id), and so on. Mirrored by the
-- parent check in desktop/syncsvc/store.go (AGENTS.md).
--
-- Hand-edited from drizzle-kit's output: the (id, user_id) keys come first
-- (an FK needs its target unique), and SET NULL names the link column. A
-- bare SET NULL on a two-column FK would null user_id too (NOT NULL), so
-- deleting a goal would fail instead of unlinking its tasks.
ALTER TABLE "goals" ADD CONSTRAINT "goals_id_owner_key" UNIQUE("id","user_id");--> statement-breakpoint
ALTER TABLE "routines" ADD CONSTRAINT "routines_id_owner_key" UNIQUE("id","user_id");--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_id_owner_key" UNIQUE("id","user_id");--> statement-breakpoint
ALTER TABLE "routines" DROP CONSTRAINT "routines_goal_id_goals_id_fk";--> statement-breakpoint
ALTER TABLE "items" DROP CONSTRAINT "items_goal_id_goals_id_fk";--> statement-breakpoint
ALTER TABLE "items" DROP CONSTRAINT "items_routine_id_routines_id_fk";--> statement-breakpoint
ALTER TABLE "time_entries" DROP CONSTRAINT "time_entries_item_id_items_id_fk";--> statement-breakpoint
-- Existing cross-owner links (only a crafted write makes one) would block the
-- new FKs: unlink them first. The sync_stamp trigger bumps synced_at, so
-- devices pull the unlinked rows. A session on someone else's item has
-- nothing to belong to, so it goes.
UPDATE "routines" r SET "goal_id" = NULL WHERE r."goal_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "goals" g WHERE g."id" = r."goal_id" AND g."user_id" = r."user_id");--> statement-breakpoint
UPDATE "items" i SET "goal_id" = NULL WHERE i."goal_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "goals" g WHERE g."id" = i."goal_id" AND g."user_id" = i."user_id");--> statement-breakpoint
UPDATE "items" i SET "routine_id" = NULL WHERE i."routine_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "routines" r WHERE r."id" = i."routine_id" AND r."user_id" = i."user_id");--> statement-breakpoint
DELETE FROM "time_entries" t WHERE NOT EXISTS (SELECT 1 FROM "items" i WHERE i."id" = t."item_id" AND i."user_id" = t."user_id");--> statement-breakpoint
ALTER TABLE "routines" ADD CONSTRAINT "routines_goal_owner_fk" FOREIGN KEY ("goal_id","user_id") REFERENCES "public"."goals"("id","user_id") ON DELETE SET NULL ("goal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_goal_owner_fk" FOREIGN KEY ("goal_id","user_id") REFERENCES "public"."goals"("id","user_id") ON DELETE SET NULL ("goal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_routine_owner_fk" FOREIGN KEY ("routine_id","user_id") REFERENCES "public"."routines"("id","user_id") ON DELETE SET NULL ("routine_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_item_owner_fk" FOREIGN KEY ("item_id","user_id") REFERENCES "public"."items"("id","user_id") ON DELETE cascade ON UPDATE no action;
