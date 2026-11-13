"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { useItemActions, usePlanned } from "@/features/items/use-items";
import { placeId, type Place } from "@/features/items/model";
import { QuickAdd } from "@/features/items/components/quick-add";
import { ItemRow } from "@/features/items/components/item-row";
import type { Item } from "@/lib/sync/db";
import { cn } from "@/lib/utils";
import { addMonths, label, monthGrid, periodOf, weekDays } from "../periods";
import { DateNav } from "./date-nav";
import { PlannerBoard } from "./planner-board";
import { PriorityPicker } from "@/features/items/components/priority-icon";
import { useItemSheet } from "@/features/items/components/item-sheet";
import { usePrefs } from "@/lib/prefs";

/* The month as a grid of day cells (each a drop target) beside the "This
   month" bucket. Drag from the bucket onto a day to schedule it; click a
   day's number to open that day; "+" (or double-click a cell's empty
   space) adds a task right there. */
export function MonthView({ date, today, go, openDay }: { date: string; today: string; go: (d: string) => void; openDay: (d: string) => void }) {
  const start = periodOf("month", date);
  const { weekStart } = usePrefs();
  const [adding, setAdding] = useState<string | null>(null);
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
      <DateNav title={label.monthName(start)} sub={label.year(start)} onPrev={() => go(addMonths(start, -1))} onNext={() => go(addMonths(start, 1))} onToday={() => go(today)} isCurrent={date === today} />
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
                  <div
                    key={d}
                    onDoubleClick={(e) => !(e.target as HTMLElement).closest("button, input, [aria-roledescription]") && setAdding(d)}
                    className={cn("group/cell flex min-h-24 flex-col gap-0.5 border-b p-1", i % 7 !== 6 && "border-r", !inMonth(d) && "bg-muted/40")}
                  >
                    <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => openDay(d)}
                      aria-label={`Open ${label.dayLong(d)}`}
                      className={cn(
                        "hover:bg-muted focus-visible:ring-ring/40 flex size-6 items-center justify-center self-start rounded-md text-xs tabular-nums outline-none focus-visible:ring-2",
                        d === today ? "bg-primary hover:bg-primary text-primary-foreground font-semibold" : inMonth(d) ? "text-foreground" : "text-subtle",
                      )}
                    >
                      {label.dayOfMonth(d)}
                    </button>
                    <button
                      type="button"
                      aria-label={`Add task on ${label.dayLong(d)}`}
                      title="Add task"
                      onClick={() => setAdding(d)}
                      className="text-subtle hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 flex size-6 items-center justify-center rounded-md opacity-0 outline-none group-hover/cell:opacity-100 focus-visible:opacity-100 focus-visible:ring-2"
                    >
                      <Plus className="size-3.5" />
                    </button>
                    </div>
                    {list(dayId(d), "flex-1")}
                    {adding === d ? <CellAdd place={{ plan_scope: "day", plan_date: d }} day={label.dayLong(d)} onClose={() => setAdding(null)} /> : null}
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

/** A day's item inside a month cell: one line. The leading icon is the
    same priority picker as every other view (small); the title opens the
    task's details. Still draggable to another day. */
function DayChip({ item }: { item: Item }) {
  const actions = useItemActions();
  const sheet = useItemSheet();
  const done = item.status === "done";
  return (
    <div className="hover:bg-muted flex min-w-0 items-center gap-0.5 rounded-md py-0.5 pr-1.5 pl-0.5 text-[11.5px]">
      {done ? (
        <span className="flex size-4 shrink-0 items-center justify-center">
          <Check className="text-subtle size-3" aria-label="Done" />
        </span>
      ) : (
        <PriorityPicker value={item.priority} onChange={(p) => void actions.edit(item, { priority: p })} className="size-4 rounded-sm" iconClassName="size-3" />
      )}
      <button
        type="button"
        onClick={() => sheet.open(item.id)}
        title={item.title}
        className={cn("min-w-0 flex-1 truncate text-left outline-none focus-visible:underline", done && "text-subtle line-through")}
      >
        {item.title}
      </button>
    </div>
  );
}

/** Inline add inside a day cell: Enter adds and stays open for the next,
    Escape closes; leaving the field keeps what was typed (it's added). */
function CellAdd({ place, day, onClose }: { place: Place; day: string; onClose: () => void }) {
  const actions = useItemActions();
  const [value, setValue] = useState("");
  return (
    <input
      autoFocus
      value={value}
      maxLength={500}
      placeholder="New task"
      aria-label={`New task on ${day}`}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && value.trim()) {
          void actions.create(value, place);
          setValue("");
        }
        if (e.key === "Escape") onClose();
      }}
      onBlur={() => {
        if (value.trim()) void actions.create(value, place);
        onClose();
      }}
      className="bg-card placeholder:text-subtle ring-ring/60 h-6 w-full rounded-sm px-1.5 text-[11.5px] ring-1 outline-none"
    />
  );
}
