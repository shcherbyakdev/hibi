"use client";

import { createContext, use } from "react";
import { DEFAULT_PREFS, type Prefs } from "./prefs-data";

const PrefsContext = createContext<Prefs>(DEFAULT_PREFS);

/** The layout parses prefs from the verified user (prefs-data.ts); Settings
    writes them and refreshes the layout. */
export function PrefsProvider({ prefs, children }: { prefs: Prefs; children: React.ReactNode }) {
  return <PrefsContext value={prefs}>{children}</PrefsContext>;
}

export const usePrefs = () => use(PrefsContext);
