"use client";

import { usePlanned, useOverdue, useInbox } from "@/features/items/use-items";
import { INBOX, placeId, type Place } from "@/features/items/model";
import { QuickAdd } from "@/features/items/components/quick-add";
import { addDays, label } from "../periods";
import { DateNav } from "./date-nav";
import { GroupHeader, PlannerBoard } from "./planner-board";
import { ItemRow } from "@/features/items/components/item-row";

export function DayView({ date, today, go }: { date: string; today: string; go: (d: string) => void }) {
  const place: Place = { plan_scope: "day", plan_date: date };
  const items = usePlanned("day", date);
  // Overdue is shown on today only: it's what you pick up from.
  const isToday = date === today;
  const overdue = useOverdue(isToday ? today : null);
  // So is the Inbox: drag in to plan for today, drag out to unplan.
  const inbox = useInbox();
  if (!items || !overdue || !inbox) return null;

  const groups = [
    ...(overdue.length ? [{ id: "overdue", items: overdue, noDrop: true }] : []),
    { id: placeId(place), items },
    ...(isToday ? [{ id: placeId(INBOX), items: inbox }] : []),
  ];
  const open = items.filter((i) => i.status !== "done" && i.status !== "dropped").length;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      {/* px-3: the heading lines up with the rows' checkboxes and labels. */}
      <div className="px-3">
      <DateNav title={date === today ? "Today" : label.weekdayLong(date)} sub={date === today ? `${label.weekdayLong(date)}, ${label.dayMonth(date)}` : label.dayMonth(date)} onPrev={() => go(addDays(date, -1))} onNext={() => go(addDays(date, 1))} onToday={() => go(today)} isCurrent={date === today} />
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
            {isToday ? (
              <section>
                <GroupHeader count={inbox.length} className="px-3">Inbox</GroupHeader>
                {list(placeId(INBOX))}
              </section>
            ) : null}
          </>
        )}
      </PlannerBoard>
    </div>
  );
}
