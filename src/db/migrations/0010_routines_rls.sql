-- Custom SQL migration: routines get the same treatment as the other synced
-- tables (0001_rls_sync.sql, 0003, 0004): owner FK, sync_stamp (LWW + pull
-- cursor), least-privilege grants, owner-only RLS, Realtime.
ALTER TABLE "routines" ADD CONSTRAINT "routines_user_id_fk" FOREIGN KEY ("user_id") REFERENCES auth.users("id") ON DELETE cascade;--> statement-breakpoint
CREATE TRIGGER routines_sync_stamp BEFORE INSERT OR UPDATE ON "routines" FOR EACH ROW EXECUTE FUNCTION public.sync_stamp();--> statement-breakpoint
REVOKE ALL ON "routines" FROM anon, authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "routines" TO authenticated;--> statement-breakpoint
ALTER TABLE "routines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "routines_owner" ON "routines" FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);--> statement-breakpoint
ALTER PUBLICATION supabase_realtime ADD TABLE "routines";
