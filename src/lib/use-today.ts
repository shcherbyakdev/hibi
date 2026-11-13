"use client";

import { useSyncExternalStore } from "react";
import { toISODate } from "@/features/planner/periods";

// "Today" in the viewer's timezone. The server can't know it, so the server
// snapshot is null and date-dependent UI renders on the client only. Rechecked
// every minute and when the tab comes back, so midnight rolls the views over.
function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, 60_000);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onChange);
  };
}

export function useToday(): string | null {
  return useSyncExternalStore(subscribe, () => toISODate(new Date()), () => null);
}
