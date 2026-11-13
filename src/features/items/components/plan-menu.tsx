"use client";

import type { Item } from "@/lib/sync/db";
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup } from "@/components/ui/dropdown-menu";
import { addDays, addMonths, periodOf } from "@/features/planner/periods";
import { useItemActions } from "../use-items";
import { INBOX, type Place } from "../model";

/** The keyboard-reachable way to move an item between day, week, month and
    the Inbox (dragging covers the pointer). */
export function PlanMenuItems({ item, today }: { item: Item; today: string }) {
  const actions = useItemActions();
  const thisWeek = periodOf("week", today);
  const thisMonth = periodOf("month", today);
  const targets: Array<[string, Place]> = [
    ["Today", { plan_scope: "day", plan_date: today }],
    ["Tomorrow", { plan_scope: "day", plan_date: addDays(today, 1) }],
    ["This week", { plan_scope: "week", plan_date: thisWeek }],
    ["Next week", { plan_scope: "week", plan_date: addDays(thisWeek, 7) }],
    ["This month", { plan_scope: "month", plan_date: thisMonth }],
    ["Next month", { plan_scope: "month", plan_date: addMonths(thisMonth, 1) }],
  ];
  const isHere = (p: Place) => item.plan_scope === p.plan_scope && item.plan_date === p.plan_date;
  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel>Plan for</DropdownMenuLabel>
        {targets.map(([name, place]) => (
          <DropdownMenuItem key={name} disabled={isHere(place)} onClick={() => actions.plan(item, place)}>
            {name}
          </DropdownMenuItem>
        ))}
        {item.plan_scope ? <DropdownMenuItem onClick={() => actions.plan(item, INBOX)}>Unplan</DropdownMenuItem> : null}
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" onClick={() => actions.remove(item)}>
        Delete
      </DropdownMenuItem>
    </>
  );
}
