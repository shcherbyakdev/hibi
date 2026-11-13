-- Custom SQL migration: time_entries gets the same treatment as the other
-- synced tables (0001_rls_sync.sql): owner FK, sync_stamp (LWW + pull
-- cursor), grants, owner-only RLS, Realtime.
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_fk" FOREIGN KEY ("user_id") REFERENCES auth.users("id") ON DELETE cascade;--> statement-breakpoint
CREATE TRIGGER time_entries_sync_stamp BEFORE INSERT OR UPDATE ON "time_entries" FOR EACH ROW EXECUTE FUNCTION public.sync_stamp();--> statement-breakpoint
REVOKE ALL ON "time_entries" FROM anon;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "time_entries" TO authenticated;--> statement-breakpoint
ALTER TABLE "time_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "time_entries_owner" ON "time_entries" FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);--> statement-breakpoint
ALTER PUBLICATION supabase_realtime ADD TABLE "time_entries";
