import type { Item } from "@/lib/sync/db";
import { addDays, startOfWeek, toISODate } from "@/features/planner/periods";

/** Done tasks per local calendar day (YYYY-MM-DD). */
export type DayCounts = Map<string, number>;

/** A goal's progress, derived from its tasks: each one counts on the
    local day it was marked done. Un-done, dropped and deleted tasks drop
    out because done_at is null / deleted_at is set. */
export function dayCounts(items: Pick<Item, "goal_id" | "done_at" | "deleted_at">[], goalId: string): DayCounts {
  const c: DayCounts = new Map();
  for (const i of items) {
    if (i.goal_id !== goalId || !i.done_at || i.deleted_at) continue;
    const d = toISODate(new Date(i.done_at));
    c.set(d, (c.get(d) ?? 0) + 1);
  }
  return c;
}

/** GitHub's five shades: 0, 1, 2, 3, 4+. */
export const level = (n: number) => Math.min(Math.max(n, 0), 4) as 0 | 1 | 2 | 3 | 4;

/** `weeks` columns of 7 dates; rows start on `weekStart`, the last column
    holds today (its later days are in the future). */
export function gridWeeks(today: string, weeks: number, weekStart: 0 | 1): string[][] {
  const first = addDays(startOfWeek(today, weekStart), -7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(first, w * 7 + d)));
}

/** Consecutive days with something done, back from today — or from
    yesterday while today is still empty, so the morning doesn't read 0. */
export function streak(counts: DayCounts, today: string): number {
  let d = counts.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (counts.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** Days this week (so far) with something done. */
export function weekCount(counts: DayCounts, today: string, weekStart: 0 | 1): number {
  const start = startOfWeek(today, weekStart);
  let n = 0;
  for (let d = start; d <= today; d = addDays(d, 1)) if (counts.has(d)) n++;
  return n;
}

/** A goal's open tasks, minus routine copies from past days: a missed
    habit day is an empty cell, not another row to clear (as in Overdue). */
export function openSteps<T extends Pick<Item, "status" | "routine_id" | "plan_date">>(items: T[], today: string): T[] {
  return items.filter((i) => (i.status === "todo" || i.status === "doing") && !(i.routine_id && i.plan_date && i.plan_date < today));
}
