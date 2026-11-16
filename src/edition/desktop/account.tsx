"use client";

import { createContext, use, useEffect, useState } from "react";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

// Read directly, not through src/env.ts: a build without them is still a
// valid Mac app, just one with no sign-in (local data only).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** False in a build made without the hosted project's URL and key. */
export const ACCOUNTS = Boolean(url && key);

let client: SupabaseClient | undefined;
/** The hosted project, as the person signed in on this Mac. The session
    lives in the window's localStorage and refreshes itself. */
export const supabase = () => (client ??= createClient(url!, key!));

/** undefined: still reading the saved session; null: not signed in. */
const AccountContext = createContext<User | null | undefined>(null);
export const useAccount = () => use(AccountContext);

/** Signing in is optional: without an account the app keeps everything on
    this Mac (the built-in service); with one it syncs with the hosted site. */
export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(ACCOUNTS ? undefined : null);
  useEffect(() => {
    if (!ACCOUNTS) return;
    // Fires at once with the saved session, then on sign-in, sign-out,
    // refresh and profile updates. No supabase calls in here (it holds
    // the client's auth lock).
    const { data } = supabase().auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  return <AccountContext value={user}>{children}</AccountContext>;
}
