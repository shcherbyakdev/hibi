import type { Item } from "@/lib/sync/db";
import { isOpen } from "@/features/items/model";

export type PickSource = "week" | "month" | "goals" | "inbox";
export const PICK_LABELS: Record<PickSource, string> = { week: "This week", month: "This month", goals: "Goals", inbox: "Inbox" };

const urgency = (i: Pick<Item, "priority">) => i.priority || 5; // 1 urgent … 4 low, then none

/** What Today offers to pull in, nearest period first: this week's and
    this month's buckets (planned, no day yet), unplanned goal tasks, the
    Inbox. Open tasks only, most urgent first (stable, so list order holds
    within a priority). Empty sources are left out. Overdue isn't here:
    Today already lists it above. */
export function pickSources<T extends Pick<Item, "status" | "priority">>(lists: Record<PickSource, T[]>): Array<{ source: PickSource; items: T[] }> {
  return (Object.keys(PICK_LABELS) as PickSource[])
    .map((source) => ({ source, items: lists[source].filter(isOpen).sort((a, b) => urgency(a) - urgency(b)) }))
    .filter((s) => s.items.length > 0);
}
