-- Custom SQL migration: fold boards into goals (docs/superpowers/plans/
-- 2026-11-14-fold-boards-into-goals.md). One way to group tasks: a goal,
-- shown as a list or a To do / Doing / Done board.
-- Every touched row gets updated_at = greatest(now(), old + 1 ms): newer
-- than anything stored, even a row a fast-clocked device stamped ahead of
-- the server's clock (sync_stamp would silently skip an older UPDATE), so
-- clients pull the change and LWW keeps it over their local copies.
-- Dexie v6 (src/lib/sync/db.ts, foldBoardItem) applies the same fold locally.

-- 1. A goal remembers its layout.
ALTER TABLE "goals" ADD COLUMN "layout" text DEFAULT 'list' NOT NULL;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_layout_valid" CHECK ("goals"."layout" in ('list', 'board'));--> statement-breakpoint
-- Existing goals are re-pulled, so local copies learn the new column.
UPDATE "goals" SET "updated_at" = greatest(now(), "updated_at" + interval '1 millisecond');--> statement-breakpoint

-- 2. Every board becomes a goal with the same id (so /boards/<id> can
--    redirect to /goals/<id>), deleted ones stay deleted.
INSERT INTO "goals" ("id", "user_id", "created_at", "updated_at", "deleted_at", "name", "icon", "layout", "sort_key")
SELECT b."id", b."user_id", b."created_at", now(), b."deleted_at", left(b."name", 120), b."icon",
       CASE WHEN b."layout" = 'kanban' THEN 'board' ELSE 'list' END, b."sort_key"
FROM "boards" b;--> statement-breakpoint

-- 3. Board tasks join their goal (a goal of their own wins); the column
--    becomes a status: "Doing" → doing (from todo), "Done" → done with a
--    done_at so it counts in the grid. Other columns, deleted columns and
--    dropped tasks keep their status.
UPDATE "items" i SET
  "goal_id" = coalesce(i."goal_id", i."board_id"),
  "status" = CASE
    WHEN i."status" = 'dropped' THEN i."status"
    WHEN lower(trim(c."name")) = 'done' THEN 'done'
    WHEN lower(trim(c."name")) = 'doing' AND i."status" = 'todo' THEN 'doing'
    ELSE i."status" END,
  "done_at" = CASE
    WHEN i."status" <> 'dropped' AND lower(trim(c."name")) = 'done' THEN coalesce(i."done_at", i."updated_at")
    ELSE i."done_at" END,
  "updated_at" = greatest(now(), i."updated_at" + interval '1 millisecond')
FROM "items" i2 LEFT JOIN "board_columns" c ON c."id" = i2."column_id" AND c."deleted_at" IS NULL
WHERE i2."id" = i."id" AND i."board_id" IS NOT NULL;--> statement-breakpoint

-- 4. Boards are gone: the item columns first (their FKs point at the
--    board tables), then the tables. Same statements drizzle generates, so
--    the schema snapshot matches.
ALTER TABLE "items" DROP CONSTRAINT "items_board_id_boards_id_fk";--> statement-breakpoint
ALTER TABLE "items" DROP CONSTRAINT "items_column_id_board_columns_id_fk";--> statement-breakpoint
DROP INDEX "items_board_id_idx";--> statement-breakpoint
DROP INDEX "items_column_id_idx";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "board_id";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "column_id";--> statement-breakpoint
DROP TABLE "board_columns";--> statement-breakpoint
DROP TABLE "boards";
