import type { Item } from "@/lib/sync/db";
import { isOpen } from "@/features/items/model";
import { addDays, addMonths, startOfMonth } from "./periods";

const urgency = (i: Pick<Item, "priority">) => i.priority || 5; // 1 urgent … 4 low, then none

/** Tasks worth pulling into today: planned for a period that is still
    running but has no day yet. This week's bucket always; this month's
    only once the month has a week or less left (before that it's just a
    long list). Most urgent first, at most `max`. */
export function suggestions<T extends Pick<Item, "status" | "priority">>(week: T[], month: T[], today: string, max = 5): T[] {
  const monthClosing = addDays(today, 7) >= addMonths(startOfMonth(today), 1);
  return [...week, ...(monthClosing ? month : [])]
    .filter(isOpen)
    .sort((a, b) => urgency(a) - urgency(b)) // stable: list order within a priority
    .slice(0, max);
}
