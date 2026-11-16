"use client";

import { usePlanned, useOverdue } from "@/features/items/use-items";
import { placeId, type Place } from "@/features/items/model";
import { QuickAdd } from "@/features/items/components/quick-add";
import { usePrefs } from "@/lib/prefs";
import { addDays, label, periodOf } from "../periods";
import { suggestions } from "../suggest";
import { DateNav } from "./date-nav";
import { PlanDay } from "./plan-day";
import { GroupHeader, PlannerBoard } from "./planner-board";
import { ItemRow } from "@/features/items/components/item-row";

export function DayView({ date, today, go }: { date: string; today: string; go: (d: string) => void }) {
  const place: Place = { plan_scope: "day", plan_date: date };
  const items = usePlanned("day", date);
  // Overdue is shown on today only: it's what you pick up from.
  const overdue = useOverdue(date === today ? today : null);
  // Suggested, on today only: what this week (and a closing month) still
  // holds without a day.
  const { weekStart } = usePrefs();
  const weekBucket = usePlanned("week", periodOf("week", today, weekStart));
  const monthBucket = usePlanned("month", periodOf("month", today));
  if (!items || !overdue || !weekBucket || !monthBucket) return null;
  const suggested = date === today ? suggestions(weekBucket, monthBucket, today) : [];

  const groups = [
    ...(overdue.length ? [{ id: "overdue", items: overdue, noDrop: true }] : []),
    { id: placeId(place), items },
    ...(suggested.length ? [{ id: "suggested", items: suggested, noDrop: true }] : []),
  ];
  const open = items.filter((i) => i.status !== "done" && i.status !== "dropped").length;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      {/* px-3: the heading lines up with the rows' checkboxes and labels. */}
      <div className="px-3">
      <DateNav title={date === today ? "Today" : label.weekdayLong(date)} sub={date === today ? `${label.weekdayLong(date)}, ${label.dayMonth(date)}` : label.dayMonth(date)} onPrev={() => go(addDays(date, -1))} onNext={() => go(addDays(date, 1))} onToday={() => go(today)} isCurrent={date === today} action={date === today ? <PlanDay today={today} /> : null} />
      </div>
      <PlannerBoard
        groups={groups}
        today={today}
        renderItem={(item, { overlay }) => (
          <ItemRow item={item} today={today} overlay={overlay} density="minimal" showPlace={item.plan_scope !== "day" || item.plan_date !== date} />
        )}
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
            {suggested.length ? (
              <section>
                <GroupHeader count={suggested.length} className="px-3">
                  Suggested
                  <span className="text-subtle order-last ml-auto tracking-normal normal-case">Drag up, or press T on a task, to do it today</span>
                </GroupHeader>
                {list("suggested")}
              </section>
            ) : null}
          </>
        )}
      </PlannerBoard>
    </div>
  );
}
