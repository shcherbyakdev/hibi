"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { usePlanned } from "@/features/items/use-items";
import { placeId } from "@/features/items/model";
import { QuickAdd } from "@/features/items/components/quick-add";
import { ItemCard } from "@/features/items/components/item-row";
import type { Item } from "@/lib/sync/db";
import { usePrefs } from "@/lib/prefs";
import { cn } from "@/lib/utils";
import { addDays, label, periodOf, weekDays } from "../periods";
import { isCellBackground, openTracks, useOpenDay } from "../open-day";
import { DateNav } from "./date-nav";
import { PlannerBoard } from "./planner-board";

const columnHeader = "flex h-8 items-center gap-1.5 px-[9px] font-mono text-[11px] uppercase tracking-[0.06em]";

/* The week without sideways scrolling: the "This week" bucket is a band on
   top (its cards flow in a grid), and the seven days share the full width
   below, wrapping onto a second row when columns would get too narrow.
   Drag between the bucket and any day, or between days, to reschedule.
   Clicking a day opens it in place: wider column (xl+) or a full row. */
export function WeekView({ date, today, go }: { date: string; today: string; go: (d: string) => void }) {
  const { weekStart } = usePrefs();
  const start = periodOf("week", date, weekStart);
  const days = weekDays(start);
  // A range, not just `start`: week tasks planned under the other week-start
  // setting are dated a day off and must still show up.
  const bucket = usePlanned("week", start, addDays(start, 6));
  const dayItems = usePlanned("day", days[0], days[6]);
  const grid = useRef<HTMLDivElement>(null);
  const { open, setOpen } = useOpenDay(start);
  const loaded = !!bucket && !!dayItems;
  // On small screens the days wrap into rows: bring today's into view.
  useEffect(() => {
    if (loaded) grid.current?.querySelector("[data-today]")?.scrollIntoView({ block: "nearest" });
  }, [loaded, start]);
  // On small screens the opened day moves onto a row of its own: follow it.
  useEffect(() => {
    if (open) grid.current?.querySelector("[data-open]")?.scrollIntoView({ block: "nearest" });
  }, [open]);
  if (!bucket || !dayItems) return null;
  const openCol = open ? days.indexOf(open) : -1;

  const byDay = new Map<string, Item[]>(days.map((d) => [d, []]));
  for (const i of dayItems) byDay.get(i.plan_date!)?.push(i);
  const bucketId = placeId({ plan_scope: "week", plan_date: start });
  const groups = [{ id: bucketId, items: bucket }, ...days.map((d) => ({ id: placeId({ plan_scope: "day", plan_date: d }), items: byDay.get(d)! }))];

  return (
    <div className="flex flex-col gap-5">
      <DateNav title="Week" sub={label.week(start)} onPrev={() => go(addDays(start, -7))} onNext={() => go(addDays(start, 7))} onToday={() => go(today)} isCurrent={date === today} />
      <PlannerBoard groups={groups} today={today} renderItem={(item, { overlay }) => <ItemCard item={item} today={today} overlay={overlay} fullTitle={item.plan_scope === "day" && item.plan_date === open} />}>
        {(list) => (
          <>
            <section className="bg-muted/60 rounded-xl p-1">
              <header className={columnHeader}>
                <span>This week</span>
                <span className="text-subtle ml-auto tabular-nums">{bucket.length || ""}</span>
              </header>
              {list(bucketId, "grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-x-1.5", true)}
              <QuickAdd place={{ plan_scope: "week", plan_date: start }} placeholder="Add to this week" />
            </section>

            {/* As many columns as fit at ≥7.5rem, in calendar order: all seven on
                a laptop, weekdays + weekend at ~1024px, two per row on phones.
                auto-fit (not fill) so the seven stretch to the full width. */}
            <div
              ref={grid}
              style={{ "--week-cols": openTracks(7, openCol) } as CSSProperties}
              className="grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-1.5 transition-[grid-template-columns] duration-200 ease-out motion-reduce:transition-none xl:grid-cols-(--week-cols)"
            >
              {days.map((d) => {
                const isToday = d === today;
                const isOpen = d === open;
                return (
                  <section
                    key={d}
                    data-today={isToday || undefined}
                    data-open={isOpen || undefined}
                    onClick={(e) => isCellBackground(e.target as Element) && setOpen(d)}
                    className={cn(
                      "flex min-w-0 flex-col rounded-xl p-1 md:min-h-56",
                      (isToday || isOpen) && "bg-brand/5",
                      isOpen && "ring-brand/30 ring-1 max-xl:col-span-full",
                    )}
                  >
                    <header>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? "Collapse" : "Expand"} ${label.dayLong(d)}`}
                        title={isOpen ? "Collapse (Esc)" : "Expand"}
                        onClick={() => setOpen(isOpen ? null : d)}
                        className={cn(columnHeader, "focus-visible:ring-ring/40 w-full rounded-md text-left outline-none focus-visible:ring-2")}
                      >
                        <span className={isToday ? "text-brand-text" : "text-muted-foreground"}>{label.weekday(d)}</span>
                        <span className={cn("tabular-nums", isToday ? "text-brand-text" : "text-subtle")}>{label.dayOfMonth(d)}</span>
                        <span className="text-subtle ml-auto tabular-nums">{byDay.get(d)!.length || ""}</span>
                      </button>
                    </header>
                    {list(placeId({ plan_scope: "day", plan_date: d }), "flex-1")}
                    <QuickAdd place={{ plan_scope: "day", plan_date: d }} placeholder="Add" />
                  </section>
                );
              })}
            </div>
          </>
        )}
      </PlannerBoard>
    </div>
  );
}
