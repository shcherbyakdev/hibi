"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { label } from "@/features/planner/periods";
import { usePrefs } from "@/lib/prefs";
import { gridWeeks, level, type DayCounts } from "../model";

// Fill strength per level; the colour is the goal's tone (currentColor).
const SHADE = ["", "opacity-40", "opacity-60", "opacity-80", "opacity-100"] as const;

/** GitHub-style grid: one column per week, one cell per day, shaded by
    how many of the goal's tasks were done that day. Scrolls on its own,
    pinned to the right so today is in view on narrow screens. */
export function ContributionGrid({ counts, today, weeks, tone }: { counts: DayCounts; today: string; weeks: number; tone: string }) {
  const { weekStart } = usePrefs();
  const cols = React.useMemo(() => gridWeeks(today, weeks, weekStart), [today, weeks, weekStart]);
  const scroller = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [weeks]);

  const total = cols.flat().reduce((n, d) => n + (counts.get(d) ?? 0), 0);

  return (
    <div ref={scroller} className="overflow-x-auto">
      <div role="img" aria-label={`${total} ${total === 1 ? "task" : "tasks"} done in the last ${weeks} weeks`} className={cn("flex w-max gap-[2px]", tone)}>
        {cols.map((days, i) => {
          const monthStart = days.find((d) => d.endsWith("-01"));
          return (
            <div key={days[0]} className="flex flex-col gap-[2px]">
              {/* Labels overflow sideways so they never widen a column — leftward in
                  the last two columns, so they can't widen the grid either. */}
              <span aria-hidden className="text-subtle relative h-3 font-mono text-[9px] leading-3 uppercase">
                {monthStart ? <span className={cn("absolute whitespace-nowrap", i >= cols.length - 2 ? "right-0" : "left-0")}>{label.monthName(monthStart).slice(0, 3)}</span> : null}
              </span>
              {days.map((d) => {
                const n = counts.get(d) ?? 0;
                const lv = level(n);
                return (
                  <span
                    key={d}
                    title={d > today ? undefined : `${n} ${n === 1 ? "task" : "tasks"} · ${label.dayShort(d)}`}
                    className={cn(
                      "size-2.5 rounded-[1px]",
                      lv ? cn("bg-current", SHADE[lv]) : "bg-foreground/[0.07]",
                      d > today && "opacity-30",
                      d === today && "ring-foreground/40 ring-1",
                    )}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
