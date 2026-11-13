"use client";

import { usePlanned, useOverdue } from "@/features/items/use-items";
import { placeId, type Place } from "@/features/items/model";
import { QuickAdd } from "@/features/items/components/quick-add";
import { addDays, label } from "../periods";
import { DateNav } from "./date-nav";
import { GroupHeader, PlannerBoard } from "./planner-board";

export function DayView({ date, today, go }: { date: string; today: string; go: (d: string) => void }) {
  const place: Place = { plan_scope: "day", plan_date: date };
  const items = usePlanned("day", date);
  // Overdue is shown on today only: it's what you pick up from.
  const overdue = useOverdue(date === today ? today : null);
  if (!items || !overdue) return null;

  const groups = [...(overdue.length ? [{ id: "overdue", items: overdue, noDrop: true }] : []), { id: placeId(place), items }];
  const open = items.filter((i) => i.status !== "done" && i.status !== "dropped").length;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <DateNav title={date === today ? `Today, ${label.dayLong(date)}` : label.dayLong(date)} onPrev={() => go(addDays(date, -1))} onNext={() => go(addDays(date, 1))} onToday={() => go(today)} isCurrent={date === today} />
      <PlannerBoard
        groups={groups}
        today={today}
        showPlace={(i) => i.plan_scope !== "day" || i.plan_date !== date}
      >
        {(list) => (
          <>
            {overdue.length ? (
              <section>
                <GroupHeader accent count={overdue.length}>
                  Overdue
                </GroupHeader>
                {list("overdue")}
              </section>
            ) : null}
            <section>
              <GroupHeader count={open}>{open ? "To do" : items.length ? "All done" : "Nothing planned"}</GroupHeader>
              {list(placeId(place))}
              <QuickAdd place={place} />
            </section>
          </>
        )}
      </PlannerBoard>
    </div>
  );
}
