-- Custom SQL migration: goals get the same treatment as the other synced
-- tables (0001_rls_sync.sql, 0003, 0004): owner FK, sync_stamp (LWW + pull
-- cursor), least-privilege grants, owner-only RLS, Realtime.
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_fk" FOREIGN KEY ("user_id") REFERENCES auth.users("id") ON DELETE cascade;--> statement-breakpoint
CREATE TRIGGER goals_sync_stamp BEFORE INSERT OR UPDATE ON "goals" FOR EACH ROW EXECUTE FUNCTION public.sync_stamp();--> statement-breakpoint
REVOKE ALL ON "goals" FROM anon, authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "goals" TO authenticated;--> statement-breakpoint
ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "goals_owner" ON "goals" FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);--> statement-breakpoint
ALTER PUBLICATION supabase_realtime ADD TABLE "goals";
