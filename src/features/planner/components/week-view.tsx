"use client";

import { useEffect, useRef } from "react";
import { usePlanned } from "@/features/items/use-items";
import { placeId } from "@/features/items/model";
import { QuickAdd } from "@/features/items/components/quick-add";
import type { Item } from "@/lib/sync/db";
import { cn } from "@/lib/utils";
import { addDays, label, periodOf, weekDays } from "../periods";
import { DateNav } from "./date-nav";
import { PlannerBoard } from "./planner-board";
import { ItemRow } from "@/features/items/components/item-row";
import { usePrefs } from "@/lib/prefs";

/* "This week" bucket + seven day columns, side by side; scrolls sideways on
   narrow screens. Drag between columns to reschedule. */
export function WeekView({ date, today, go }: { date: string; today: string; go: (d: string) => void }) {
  const { weekStart } = usePrefs();
  const start = periodOf("week", date, weekStart);
  const days = weekDays(start);
  // A range, not just `start`: week tasks planned under the other week-start
  // setting are dated a day off and must still show up.
  const bucket = usePlanned("week", start, addDays(start, 6));
  const dayItems = usePlanned("day", days[0], days[6]);
  const scroller = useRef<HTMLDivElement>(null);
  const loaded = !!bucket && !!dayItems;
  // Narrow screens show a few columns: bring today's into view.
  useEffect(() => {
    if (loaded) scroller.current?.querySelector("[data-today]")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [loaded, start]);
  if (!bucket || !dayItems) return null;

  const byDay = new Map<string, Item[]>(days.map((d) => [d, []]));
  for (const i of dayItems) byDay.get(i.plan_date!)?.push(i);
  const groups = [
    { id: placeId({ plan_scope: "week", plan_date: start }), items: bucket },
    ...days.map((d) => ({ id: placeId({ plan_scope: "day", plan_date: d }), items: byDay.get(d)! })),
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <DateNav title="Week" sub={label.week(start)} onPrev={() => go(addDays(start, -7))} onNext={() => go(addDays(start, 7))} onToday={() => go(today)} isCurrent={date === today} />
      <div ref={scroller} className="-mx-6 flex min-h-0 flex-1 gap-2 overflow-x-auto px-6 pb-2">
        <PlannerBoard
          groups={groups}
          today={today}
          // Narrow columns: titles wrap, metadata goes underneath.
          renderItem={(item, { overlay }) => <ItemRow item={item} today={today} overlay={overlay} density="card" />}
        >
          {(list) =>
            groups.map((g) => {
            const isBucket = g.id.startsWith("week:");
            const d = g.id.slice(4);
            return (
              <section key={g.id} data-today={d === today || undefined} className={cn("flex min-w-48 flex-1 basis-0 flex-col rounded-xl p-1", isBucket ? "bg-muted/60" : d === today && "bg-brand/5")}>
                <header className="flex h-8 items-center gap-1.5 px-2 font-mono text-[11px] uppercase tracking-[0.06em]">
                  {isBucket ? (
                    <span>This week</span>
                  ) : (
                    <>
                      <span className={d === today ? "text-brand-text" : "text-muted-foreground"}>{label.weekday(d)}</span>
                      <span className={cn("tabular-nums", d === today ? "text-brand-text" : "text-subtle")}>{label.dayOfMonth(d)}</span>
                    </>
                  )}
                  <span className="text-subtle ml-auto tabular-nums">{g.items.length || ""}</span>
                </header>
                {list(g.id)}
                <QuickAdd place={isBucket ? { plan_scope: "week", plan_date: start } : { plan_scope: "day", plan_date: d }} placeholder="Add" />
              </section>
            );
            })
          }
        </PlannerBoard>
      </div>
    </div>
  );
}
