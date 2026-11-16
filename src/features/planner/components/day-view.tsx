"use client";

import { useState } from "react";
import type { Item } from "@/lib/sync/db";
import { useGoalBacklog, useInbox, useItemActions, usePlanned, useOverdue } from "@/features/items/use-items";
import { placeId, type Place } from "@/features/items/model";
import { QuickAdd } from "@/features/items/components/quick-add";
import { ItemRow } from "@/features/items/components/item-row";
import { usePrefs } from "@/lib/prefs";
import { cn } from "@/lib/utils";
import { addDays, label, periodOf } from "../periods";
import { PICK_LABELS, pickSources, type PickSource } from "../pick";
import { DateNav } from "./date-nav";
import { GroupHeader, PlannerBoard } from "./planner-board";

export function DayView({ date, today, go }: { date: string; today: string; go: (d: string) => void }) {
  const place: Place = { plan_scope: "day", plan_date: date };
  const isToday = date === today;
  const items = usePlanned("day", date);
  // Overdue and "Pick for today" show on today only: it's where you plan from.
  const overdue = useOverdue(isToday ? today : null);
  const { weekStart } = usePrefs();
  const week = usePlanned("week", periodOf("week", today, weekStart));
  const month = usePlanned("month", periodOf("month", today));
  const goals = useGoalBacklog();
  const inbox = useInbox();
  const actions = useItemActions();
  const [chosen, setChosen] = useState<PickSource | null>(null);
  if (!items || !overdue || !week || !month || !goals || !inbox) return null;

  const sources = isToday ? pickSources({ week, month, goals, inbox }) : [];
  // The chosen source while it has tasks; otherwise the nearest one that does.
  const pick = sources.find((s) => s.source === chosen) ?? sources[0];
  const pickIds = new Set(pick?.items.map((i) => i.id));
  const toToday = (item: Item) => void actions.plan(item, place);

  const groups = [
    ...(overdue.length ? [{ id: "overdue", items: overdue, noDrop: true }] : []),
    { id: placeId(place), items },
    ...(pick ? [{ id: "pick", items: pick.items, noDrop: true }] : []),
  ];
  const open = items.filter((i) => i.status !== "done" && i.status !== "dropped").length;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      {/* px-3: the heading lines up with the rows' checkboxes and labels. */}
      <div className="px-3">
        <DateNav title={isToday ? "Today" : label.weekdayLong(date)} sub={isToday ? `${label.weekdayLong(date)}, ${label.dayMonth(date)}` : label.dayMonth(date)} onPrev={() => go(addDays(date, -1))} onNext={() => go(addDays(date, 1))} onToday={() => go(today)} isCurrent={isToday} />
      </div>
      <PlannerBoard
        groups={groups}
        today={today}
        renderItem={(item, { overlay }) => {
          const picking = pickIds.has(item.id);
          return (
            <ItemRow
              item={item}
              today={today}
              overlay={overlay}
              density="minimal"
              onToday={picking ? () => toToday(item) : undefined}
              showPlace={!picking && (item.plan_scope !== "day" || item.plan_date !== date)}
            />
          );
        }}
      >
        {(list) => (
          <>
            {overdue.length ? (
              <section>
                <GroupHeader accent count={overdue.length} className="px-3">
                  Overdue
                </GroupHeader>
                {list("overdue")}
              </section>
            ) : null}
            <section>
              <GroupHeader count={open} className="px-3">{open ? "To do" : items.length ? "All done" : "Nothing planned"}</GroupHeader>
              {list(placeId(place))}
              <QuickAdd place={place} className="h-11 gap-3 px-3 text-[14px]" />
            </section>
            {pick ? (
              <section>
                {/* The sources sit in the header itself, styled as labels: no extra row, no popup. */}
                <div role="tablist" aria-label="Pick for today from" className="flex h-8 flex-wrap items-center gap-x-4 px-3 font-mono text-[11px] tracking-[0.06em] uppercase">
                  <span className="text-muted-foreground">Pick for today</span>
                  {sources.map((s) => (
                    <button
                      key={s.source}
                      type="button"
                      role="tab"
                      aria-selected={s === pick}
                      onClick={() => setChosen(s.source)}
                      className={cn("flex items-center gap-1.5 outline-none focus-visible:underline", s === pick ? "text-foreground" : "text-subtle hover:text-muted-foreground")}
                    >
                      {PICK_LABELS[s.source]}
                      <span className="text-subtle tabular-nums">{s.items.length}</span>
                    </button>
                  ))}
                </div>
                {list("pick")}
              </section>
            ) : null}
          </>
        )}
      </PlannerBoard>
    </div>
  );
}
