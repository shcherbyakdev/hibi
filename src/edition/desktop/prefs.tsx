"use client";

import { createContext, use, useCallback, useEffect, useState } from "react";
import { DEFAULT_PREFS, type Prefs } from "@/lib/prefs-data";
import { PrefsProvider } from "@/lib/prefs";

type Ctx = { save: (p: Prefs) => Promise<boolean> };
const DesktopPrefsContext = createContext<Ctx>({ save: async () => false });
export const useDesktopPrefs = () => use(DesktopPrefsContext);

const fromRow = (r: { week_start?: unknown }): Prefs => ({ weekStart: r.week_start === 0 || r.week_start === 1 ? r.week_start : DEFAULT_PREFS.weekStart });

/** Prefs live in the built-in sync service (GET/PUT /prefs, last write
    wins), so every device paired with this Mac agrees. Re-read whenever
    the service hints that something changed. */
export function DesktopPrefsProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/prefs")
        .then((res) => (res.ok ? res.json() : null))
        .then((row) => alive && row && setPrefs(fromRow(row)))
        .catch(() => {}); // in-process service; a miss keeps what we have
    load();
    const events = new EventSource("/sync/events");
    events.onmessage = load;
    return () => {
      alive = false;
      events.close();
    };
  }, []);
  const save = useCallback(
    async (p: Prefs) => {
      const before = prefs;
      setPrefs(p);
      const res = await fetch("/prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_start: p.weekStart, updated_at: new Date().toISOString() }),
      }).catch(() => null);
      if (!res?.ok) setPrefs(before);
      return !!res?.ok;
    },
    [prefs],
  );
  return (
    <DesktopPrefsContext value={{ save }}>
      <PrefsProvider prefs={prefs}>{children}</PrefsProvider>
    </DesktopPrefsContext>
  );
}
