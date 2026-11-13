"use client";

import { useToday } from "@/lib/use-today";
import { useInbox } from "../use-items";
import { INBOX, placeId } from "../model";
import { QuickAdd } from "./quick-add";
import { ItemRow } from "./item-row";
import { PlannerBoard, GroupHeader } from "@/features/planner/components/planner-board";

/** Everything unplanned and on no board: capture here, plan later. Same
    roomy rows and 12px text inset as Today, so the two line up. */
export function Inbox() {
  const today = useToday();
  const items = useInbox();
  if (!today || !items) return null;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
      <QuickAdd place={INBOX} placeholder="Capture a task" className="h-11 gap-3 px-3 text-[14px]" />
      <PlannerBoard
        groups={[{ id: placeId(INBOX), items }]}
        today={today}
        renderItem={(item, { overlay }) => <ItemRow item={item} today={today} overlay={overlay} density="minimal" />}
      >
        {(list) => (
          <section>
            <GroupHeader count={items.length} className="px-3">{items.length ? "Unplanned" : "Inbox zero"}</GroupHeader>
            {list(placeId(INBOX))}
          </section>
        )}
      </PlannerBoard>
    </div>
  );
}
