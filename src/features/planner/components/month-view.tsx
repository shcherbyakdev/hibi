"use client";

import { useRef, useState, type CSSProperties } from "react";
import { Check, Maximize2, Minimize2, Plus } from "lucide-react";
import { useItemActions, usePlanned } from "@/features/items/use-items";
import { placeId, type Place } from "@/features/items/model";
import { QuickAdd } from "@/features/items/components/quick-add";
import { ItemCard, ItemRow } from "@/features/items/components/item-row";
import type { Item } from "@/lib/sync/db";
import { cn } from "@/lib/utils";
import { addMonths, label, monthGrid, periodOf, weekDays } from "../periods";
import { DateNav } from "./date-nav";
import { PlannerBoard } from "./planner-board";
import { PriorityPicker } from "@/features/items/components/priority-icon";
import { useItemSheet } from "@/features/items/components/item-sheet";
import { usePrefs } from "@/lib/prefs";
import { cellClickIntent, isCellBackground, openTracks, useOpenDay } from "../open-day";

/* The month as a grid of day cells (each a drop target) beside the "This
   month" bucket. Drag from the bucket onto a day to schedule it; click a
   day's number to open that day; "+" (or double-click a cell's empty
   space) adds a task right there. Clicking a cell's empty space opens that
   day in place: it widens within its week, its tasks show as full cards,
   and that week's other days squeeze; other weeks are untouched. */
export function MonthView({ date, today, go, openDay }: { date: string; today: string; go: (d: string) => void; openDay: (d: string) => void }) {
  const start = periodOf("month", date);
  const { weekStart } = usePrefs();
  const [adding, setAdding] = useState<string | null>(null);
  const firstClickOnBackground = useRef(false);
  const grid = monthGrid(start, weekStart);
  const { open, setOpen } = useOpenDay(start);
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
        renderItem={(item, { overlay }) =>
          item.plan_scope !== "day" || overlay ? <ItemRow item={item} today={today} overlay={overlay} /> : item.plan_date === open ? <ItemCard item={item} today={today} fullTitle /> : <DayChip item={item} />
        }
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
              <div className="min-w-[42rem] overflow-hidden rounded-xl border">
                <div className="grid grid-cols-7">
                  {weekDays(grid[0][0]).map((d) => (
                    <div key={d} className="text-subtle border-b px-2 py-1.5 text-xs font-medium">
                      {label.weekday(d)}
                    </div>
                  ))}
                </div>
                {/* Each week is its own grid: only the open day's week reshapes,
                    the other weeks stay lined up under the weekday header. */}
                {grid.map((week) => (
                  <div
                    key={week[0]}
                    style={{ "--week-cols": openTracks(7, open ? week.indexOf(open) : -1) } as CSSProperties}
                    className="grid grid-cols-(--week-cols) transition-[grid-template-columns] duration-200 ease-out motion-reduce:transition-none"
                  >
                    {week.map((d, i) => (
                      <div
                        key={d}
                        onClickCapture={(e) => {
                          // Capture phase: a double-click's second click must not reach the
                          // card that opening the day just put under the pointer.
                          const background = isCellBackground(e.target as Element);
                          const intent = cellClickIntent(e.detail, background, firstClickOnBackground.current);
                          if (e.detail === 1) firstClickOnBackground.current = background;
                          if (intent === "add") {
                            e.stopPropagation();
                            setOpen(d);
                            setAdding(d);
                          } else if (intent === "open") setOpen(d);
                        }}
                        className={cn("group/cell flex min-h-24 min-w-0 flex-col gap-0.5 border-b p-1", i % 7 !== 6 && "border-r", open === d ? "bg-brand/5" : !inMonth(d) && "bg-muted/40")}
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
                        <div className="flex">
                          <button
                            type="button"
                            aria-expanded={open === d}
                            aria-label={`${open === d ? "Collapse" : "Expand"} ${label.dayLong(d)}`}
                            title={open === d ? "Collapse (Esc)" : "Expand"}
                            onClick={() => setOpen(open === d ? null : d)}
                            className={cn(cellIcon, open === d && "opacity-100")}
                          >
                            {open === d ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
                          </button>
                          <button type="button" aria-label={`Add task on ${label.dayLong(d)}`} title="Add task" onClick={() => setAdding(d)} className={cellIcon}>
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                        </div>
                        {list(dayId(d), "flex-1")}
                        {adding === d ? <CellAdd place={{ plan_scope: "day", plan_date: d }} day={label.dayLong(d)} onClose={() => setAdding(null)} /> : null}
                      </div>
                    ))}
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

const cellIcon =
  "text-subtle hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 flex size-6 items-center justify-center rounded-md opacity-0 outline-none group-hover/cell:opacity-100 focus-visible:opacity-100 focus-visible:ring-2";

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
