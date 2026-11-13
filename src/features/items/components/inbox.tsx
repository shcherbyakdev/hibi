"use client";

import { useToday } from "@/lib/use-today";
import { useInbox } from "../use-items";
import { INBOX, placeId } from "../model";
import { QuickAdd } from "./quick-add";
import { PlannerBoard, GroupHeader } from "@/features/planner/components/planner-board";

/** Everything unplanned and on no board: capture here, plan later. */
export function Inbox() {
  const today = useToday();
  const items = useInbox();
  if (!today || !items) return null;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
      <QuickAdd place={INBOX} placeholder="Capture a task" />
      <PlannerBoard groups={[{ id: placeId(INBOX), items }]} today={today}>
        {(list) => (
          <section>
            <GroupHeader count={items.length}>{items.length ? "Unplanned" : "Inbox zero"}</GroupHeader>
            {list(placeId(INBOX))}
          </section>
        )}
      </PlannerBoard>
    </div>
  );
}
