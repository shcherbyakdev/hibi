"use client";

import { Check } from "lucide-react";
import { usePlanned } from "@/features/items/use-items";
import { placeId } from "@/features/items/model";
import { QuickAdd } from "@/features/items/components/quick-add";
import { ItemRow } from "@/features/items/components/item-row";
import type { Item } from "@/lib/sync/db";
import { cn } from "@/lib/utils";
import { addMonths, label, monthGrid, periodOf, weekDays } from "../periods";
import { DateNav } from "./date-nav";
import { PlannerBoard } from "./planner-board";
import { usePrefs } from "@/lib/prefs";

/* The month as a grid of day cells (each a drop target) beside the "This
   month" bucket. Drag from the bucket onto a day to schedule it; click a
   day's number to open that day. */
export function MonthView({ date, today, go, openDay }: { date: string; today: string; go: (d: string) => void; openDay: (d: string) => void }) {
  const start = periodOf("month", date);
  const { weekStart } = usePrefs();
  const grid = monthGrid(start, weekStart);
  const bucket = usePlanned("month", start);
  const dayItems = usePlanned("day", grid[0][0], grid.at(-1)!.at(-1)!);
  if (!bucket || !dayItems) return null;

  const byDay = new Map<string, Item[]>(grid.flat().map((d) => [d, []]));
  for (const i of dayItems) byDay.get(i.plan_date!)?.push(i);
  const bucketId = placeId({ plan_scope: "month", plan_date: start });
  const dayId = (d: string) => placeId({ plan_scope: "day", plan_date: d });
  const groups = [{ id: bucketId, items: bucket }, ...grid.flat().map((d) => ({ id: dayId(d), items: byDay.get(d)! }))];
  const inMonth = (d: string) => d.slice(0, 7) === start.slice(0, 7);

  return (
    <div className="flex flex-col gap-5">
      <DateNav title={label.month(start)} onPrev={() => go(addMonths(start, -1))} onNext={() => go(addMonths(start, 1))} onToday={() => go(today)} isCurrent={date === today} />
      <PlannerBoard
        groups={groups}
        today={today}
        renderItem={(item, { overlay }) => (item.plan_scope === "day" && !overlay ? <DayChip item={item} /> : <ItemRow item={item} today={today} overlay={overlay} />)}
      >
        {(list) => (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <section className="bg-muted/60 flex w-full shrink-0 flex-col rounded-xl p-1 lg:w-64">
              <header className="flex h-8 items-center px-2 text-xs font-medium">
                This month
                <span className="text-subtle ml-auto tabular-nums">{bucket.length || ""}</span>
              </header>
              {list(bucketId)}
              <QuickAdd place={{ plan_scope: "month", plan_date: start }} placeholder="Add" />
            </section>
            <div className="min-w-0 flex-1 overflow-x-auto">
              <div className="grid min-w-[42rem] grid-cols-7 overflow-hidden rounded-xl border">
                {weekDays(grid[0][0]).map((d) => (
                  <div key={d} className="text-subtle border-b px-2 py-1.5 text-xs font-medium">
                    {label.weekday(d)}
                  </div>
                ))}
                {grid.flat().map((d, i) => (
                  <div key={d} className={cn("flex min-h-24 flex-col gap-0.5 border-b p-1", i % 7 !== 6 && "border-r", !inMonth(d) && "bg-muted/40")}>
                    <button
                      type="button"
                      onClick={() => openDay(d)}
                      aria-label={`Open ${label.dayLong(d)}`}
                      className={cn(
                        "hover:bg-muted focus-visible:ring-ring/40 flex size-6 items-center justify-center self-start rounded-full text-xs tabular-nums outline-none focus-visible:ring-2",
                        d === today ? "bg-brand hover:bg-brand font-semibold text-white" : inMonth(d) ? "text-foreground" : "text-subtle",
                      )}
                    >
                      {label.dayOfMonth(d)}
                    </button>
                    {list(dayId(d), "flex-1")}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </PlannerBoard>
    </div>
  );
}

/** A day's item inside a month cell: one truncated line. */
function DayChip({ item }: { item: Item }) {
  const done = item.status === "done";
  return (
    <div className={cn("hover:bg-muted flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11.5px]", done && "text-subtle line-through")}>
      {done ? <Check className="size-3 shrink-0" /> : <span className="bg-foreground/30 size-1.5 shrink-0 rounded-full" />}
      <span className="truncate">{item.title}</span>
    </div>
  );
}
