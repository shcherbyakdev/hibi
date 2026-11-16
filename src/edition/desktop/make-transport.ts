import { createHttpTransport } from "@/lib/sync/http-transport";
import { createSupabaseTransport } from "@/lib/sync/supabase-transport";
import type { SyncTransport } from "@/lib/sync/transport";
import { LOCAL_USER_ID } from "@/lib/edition";
import { supabase } from "./account";

/** Desktop edition. Not signed in: the app's built-in service (same
    origin, so relative URLs — nothing touches window at build-time
    prerender). Signed in: the hosted site's Supabase, like a browser. */
export const makeTransport = (userId: string): SyncTransport =>
  userId === LOCAL_USER_ID ? createHttpTransport("") : createSupabaseTransport(supabase(), userId);
