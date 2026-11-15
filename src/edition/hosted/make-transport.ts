import { createClient } from "@/lib/supabase/client";
import { createSupabaseTransport } from "@/lib/sync/supabase-transport";
import type { SyncTransport } from "@/lib/sync/transport";

/** Hosted edition: sync with Supabase as the signed-in user. */
export const makeTransport = (userId: string): SyncTransport => createSupabaseTransport(createClient(), userId);
