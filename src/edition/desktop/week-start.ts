"use client";

import { useDesktopPrefs } from "./prefs";

/** Saves week start in the built-in sync service, so paired phones agree. */
export function useSaveWeekStart() {
  const { save } = useDesktopPrefs();
  return (ws: 0 | 1) => save({ weekStart: ws });
}

export const WEEK_START_HINT = "Saved on this Mac, so your phone agrees once it's paired.";
