"use client";

import { useDesktopPrefs } from "./prefs";

/** Saves week start to the account when signed in, else on this Mac. */
export function useSaveWeekStart() {
  const { save } = useDesktopPrefs();
  return (ws: 0 | 1) => save({ weekStart: ws });
}

export const WEEK_START_HINT = "Saved with your data.";
