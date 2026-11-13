-- Custom SQL migration: everything about the synced tables that Drizzle's
-- schema can't express. Applies to boards, board_columns and items alike.

-- 1. Owner FK. auth.users is managed by Supabase, outside Drizzle.
ALTER TABLE "boards" ADD CONSTRAINT "boards_user_id_fk" FOREIGN KEY ("user_id") REFERENCES auth.users("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "board_columns" ADD CONSTRAINT "board_columns_user_id_fk" FOREIGN KEY ("user_id") REFERENCES auth.users("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_user_id_fk" FOREIGN KEY ("user_id") REFERENCES auth.users("id") ON DELETE cascade;--> statement-breakpoint

-- 2. Sync stamp (docs/PLAN.md §2).
--    - Last-write-wins: an UPDATE carrying an older client updated_at than
--      the stored row is dropped (RETURN NULL skips the row; this also fires
--      on the DO UPDATE branch of PostgREST's upsert). So a device coming
--      back online can't clobber a newer edit made elsewhere.
--    - synced_at is the server clock and the pull cursor; clients can't set it.
-- ponytail: now() is transaction start, so a long transaction can commit
-- with an older synced_at than one already pulled. The client pulls with a
-- few seconds of overlap (idempotent bulkPut) instead of a gapless sequence.
CREATE FUNCTION public.sync_stamp() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.updated_at < OLD.updated_at THEN
    RETURN NULL;
  END IF;
  NEW.synced_at := now();
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER boards_sync_stamp BEFORE INSERT OR UPDATE ON "boards" FOR EACH ROW EXECUTE FUNCTION public.sync_stamp();--> statement-breakpoint
CREATE TRIGGER board_columns_sync_stamp BEFORE INSERT OR UPDATE ON "board_columns" FOR EACH ROW EXECUTE FUNCTION public.sync_stamp();--> statement-breakpoint
CREATE TRIGGER items_sync_stamp BEFORE INSERT OR UPDATE ON "items" FOR EACH ROW EXECUTE FUNCTION public.sync_stamp();--> statement-breakpoint

-- 3. Grants. GRANT and RLS are separate gates; both are needed. Explicit
--    because newer Supabase images no longer auto-grant on public tables
--    (pipline-app 0004). anon gets nothing: there are no public reads.
REVOKE ALL ON "boards", "board_columns", "items" FROM anon;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "boards", "board_columns", "items" TO authenticated;--> statement-breakpoint

-- 4. RLS: a row belongs to its owner, full stop. (select auth.uid()) is
--    evaluated once per query, not per row; user_id leads the indexes.
-- ponytail: board_id/column_id FKs bypass RLS, so a crafted write could point
-- at another user's board id. It leaks nothing (that board stays invisible);
-- add composite (id, user_id) FKs if boards are ever shared.
ALTER TABLE "boards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "board_columns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "boards_owner" ON "boards" FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "board_columns_owner" ON "board_columns" FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "items_owner" ON "items" FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);--> statement-breakpoint

-- 5. Realtime: postgres_changes for the pull loop (respects RLS).
ALTER PUBLICATION supabase_realtime ADD TABLE "boards", "board_columns", "items";
