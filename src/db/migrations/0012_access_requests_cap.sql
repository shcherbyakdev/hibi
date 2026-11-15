-- Custom SQL migration: cap access requests at 30 an hour.
-- anon may insert into access_requests (0006) and the REST API takes that
-- insert straight from the public anon key, skipping the form's honeypot,
-- so without a cap anyone could flood the list. The database sees no IP,
-- so the cap is global: past 30 in the last hour, inserts fail with 54000
-- until the hour rolls over. Real volume for an invite list is far below.
-- ponytail: count-then-insert isn't atomic, so parallel bursts can overshoot
-- by a few rows; a per-hour counter row would make it exact.
--
-- SECURITY DEFINER: anon can't SELECT this table (no read policy), so an
-- invoker-rights count would always see 0 rows. Locked down: empty
-- search_path, fully qualified names, no EXECUTE for API roles (a trigger
-- fires without it; nobody can call it as an RPC).
CREATE FUNCTION public.access_requests_cap() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT count(*) FROM public.access_requests WHERE created_at > now() - interval '1 hour') >= 30 THEN
    RAISE EXCEPTION 'too many access requests in the last hour' USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.access_requests_cap() FROM PUBLIC, anon, authenticated;--> statement-breakpoint
CREATE TRIGGER access_requests_cap BEFORE INSERT ON "access_requests" FOR EACH ROW EXECUTE FUNCTION public.access_requests_cap();
