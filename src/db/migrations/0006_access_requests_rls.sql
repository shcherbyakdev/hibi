-- Custom SQL migration: anyone may add an email to access_requests; nobody
-- can read, change or delete through the API (no SELECT/UPDATE/DELETE grants
-- or policies). The owner reads it in the dashboard (postgres role).
ALTER TABLE "access_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON "access_requests" FROM anon, authenticated;--> statement-breakpoint
GRANT INSERT ("email") ON "access_requests" TO anon, authenticated;--> statement-breakpoint
CREATE POLICY "anyone can request access" ON "access_requests" FOR INSERT TO anon, authenticated WITH CHECK (true);
