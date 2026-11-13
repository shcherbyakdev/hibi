"use client";

import { useSearchParams } from "next/navigation";
import { useToday } from "@/lib/use-today";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The date a planner view is looking at: `?d=YYYY-MM-DD`, else today.
    Changing it is a plain history push — Next keeps useSearchParams in sync,
    and no server round-trip happens. null until the client knows "today". */
export function usePlanDate(): { date: string; today: string; go: (d: string) => void } | null {
  const today = useToday();
  const d = useSearchParams().get("d");
  if (!today) return null;
  const date = d && ISO_DATE.test(d) && !Number.isNaN(Date.parse(d)) ? d : today;
  const go = (next: string) => window.history.pushState(null, "", next === today ? "?" : `?d=${next}`);
  return { date, today, go };
}
