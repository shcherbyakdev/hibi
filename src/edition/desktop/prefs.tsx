"use client";

import { createContext, use, useCallback, useEffect, useState } from "react";
import { DEFAULT_PREFS, prefsFrom, type Prefs } from "@/lib/prefs-data";
import { PrefsProvider } from "@/lib/prefs";
import { supabase, useAccount } from "./account";

type Ctx = { save: (p: Prefs) => Promise<boolean> };
const DesktopPrefsContext = createContext<Ctx>({ save: async () => false });
export const useDesktopPrefs = () => use(DesktopPrefsContext);

const fromRow = (r: { week_start?: unknown }): Prefs => ({ weekStart: r.week_start === 0 || r.week_start === 1 ? r.week_start : DEFAULT_PREFS.weekStart });

/** Signed in, prefs are the account's (user_metadata), as on the site.
    Otherwise they live in the built-in sync service (GET/PUT /prefs, last
    write wins), re-read whenever the service hints that something changed. */
export function DesktopPrefsProvider({ children }: { children: React.ReactNode }) {
  const user = useAccount();
  const signedIn = !!user;
  const [local, setLocal] = useState<Prefs>(DEFAULT_PREFS);
  useEffect(() => {
    if (signedIn) return;
    let alive = true;
    const load = () =>
      fetch("/prefs")
        .then((res) => (res.ok ? res.json() : null))
        .then((row) => alive && row && setLocal(fromRow(row)))
        .catch(() => {}); // in-process service; a miss keeps what we have
    load();
    const events = new EventSource("/sync/events");
    events.onmessage = load;
    return () => {
      alive = false;
      events.close();
    };
  }, [signedIn]);
  const save = useCallback(
    async (p: Prefs) => {
      if (signedIn) {
        // The auth listener (account.tsx) hands the updated user back.
        const { error } = await supabase().auth.updateUser({ data: { week_start: p.weekStart } });
        return !error;
      }
      const before = local;
      setLocal(p);
      const res = await fetch("/prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_start: p.weekStart, updated_at: new Date().toISOString() }),
      }).catch(() => null);
      if (!res?.ok) setLocal(before);
      return !!res?.ok;
    },
    [signedIn, local],
  );
  return (
    <DesktopPrefsContext value={{ save }}>
      <PrefsProvider prefs={user ? prefsFrom(user.user_metadata) : local}>{children}</PrefsProvider>
    </DesktopPrefsContext>
  );
}
