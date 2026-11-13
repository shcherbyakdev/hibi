-- Custom SQL migration: least privilege on the synced tables. Supabase's
-- default ACL also hands `authenticated` TRUNCATE, REFERENCES and TRIGGER
-- on new public tables; the app needs only SELECT/INSERT/UPDATE/DELETE
-- (0001/0003). TRUNCATE in particular ignores RLS, so it must not be held
-- even though PostgREST cannot issue it.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON "boards", "board_columns", "items", "time_entries" FROM authenticated, anon;
