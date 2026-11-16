"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Item } from "@/lib/sync/db";
import { useSync } from "@/lib/sync/provider";
import { usePrefs } from "@/lib/prefs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useInbox, useItemActions, useOverdue, usePlanned } from "@/features/items/use-items";
import { INBOX, isOpen, placeLabel, type Place } from "@/features/items/model";
import { PriorityIcon } from "@/features/items/components/priority-icon";
import { periodOf } from "../periods";

type Step = { id: string; from: string };

/** "Plan my day": walk through what could be today's work — overdue first,
    then this week's bucket, then the Inbox — one task at a time, one key
    each. The same letters as on a focused row (T / W / M / U / X), so
    there is nothing new to learn. The queue is fixed when it opens:
    tasks leave their lists as you decide, the walk doesn't reshuffle. */
export function PlanDay({ today }: { today: string }) {
  const { db } = useSync();
  const { weekStart } = usePrefs();
  const actions = useItemActions();
  const thisWeek = periodOf("week", today, weekStart);
  const overdue = useOverdue(today);
  const week = usePlanned("week", thisWeek);
  const inbox = useInbox();
  const planned = usePlanned("day", today);

  const [queue, setQueue] = React.useState<Step[] | null>(null);
  const [at, setAt] = React.useState(0);
  const popup = React.useRef<HTMLDivElement>(null);
  const step = queue?.[at];
  const item = useLiveQuery(() => (step ? db.items.get(step.id) : undefined), [db, step?.id]);

  if (!overdue || !week || !inbox) return null;
  const candidates: Step[] = [
    ...overdue.map((i) => ({ id: i.id, from: `Overdue · ${placeLabel(i)}` })),
    ...week.filter(isOpen).map((i) => ({ id: i.id, from: "This week" })),
    ...inbox.filter(isOpen).map((i) => ({ id: i.id, from: "Inbox" })),
  ];
  if (!candidates.length && !queue) return null;

  const next = () => setAt((n) => n + 1);
  const plan = (it: Item, place: Place) => (void actions.plan(it, place), next());
  const choices: Array<{ key: string; label: string; run: (it: Item) => void }> = [
    { key: "T", label: "Today", run: (it) => plan(it, { plan_scope: "day", plan_date: today }) },
    { key: "W", label: "This week", run: (it) => plan(it, { plan_scope: "week", plan_date: thisWeek }) },
    { key: "M", label: "This month", run: (it) => plan(it, { plan_scope: "month", plan_date: periodOf("month", today) }) },
    { key: "U", label: "Unplan", run: (it) => plan(it, INBOX) },
    { key: "X", label: "Done", run: (it) => (void actions.toggleDone(it), next()) },
    { key: "→", label: "Skip", run: next },
  ];

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "ArrowLeft") return e.preventDefault(), setAt((n) => Math.max(0, n - 1));
    const choice = choices.find((c) => c.key.toLowerCase() === e.key.toLowerCase() || (c.key === "→" && e.key === "ArrowRight"));
    if (!choice || !item) return;
    e.preventDefault();
    choice.run(item);
  };

  const todayOpen = planned?.filter(isOpen).length ?? 0;
  const done = queue !== null && at >= queue.length;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        title="Plan my day (D)"
        data-plan-day
        onClick={() => {
          setQueue(candidates);
          setAt(0);
        }}
      >
        Plan my day
        <span className="text-subtle tabular-nums">{candidates.length}</span>
      </Button>
      <Dialog open={queue !== null} onOpenChange={(o) => !o && setQueue(null)}>
        <DialogContent ref={popup} initialFocus={popup} onKeyDown={onKeyDown} className="gap-5 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Plan my day</DialogTitle>
            <DialogDescription>
              {done ? "That's everything." : `${at + 1} of ${queue?.length ?? 0}`} · {todayOpen} planned for today
            </DialogDescription>
          </DialogHeader>
          {done ? (
            <Button onClick={() => setQueue(null)} className="self-start">
              Start the day
            </Button>
          ) : item ? (
            <>
              <div className="flex flex-col gap-1.5">
                <div className="text-muted-foreground font-mono text-[11px] tracking-[0.06em] uppercase">{step!.from}</div>
                <div className="flex items-start gap-2 text-[15px]">
                  {item.priority ? <PriorityIcon priority={item.priority} className="mt-0.5" /> : null}
                  <span className="min-w-0 break-words">{item.title}</span>
                </div>
                {item.notes ? <p className="text-muted-foreground line-clamp-2 text-xs">{item.notes}</p> : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {choices.map((c) => (
                  <Button key={c.key} variant={c.key === "T" ? "default" : "outline"} size="sm" onClick={() => c.run(item)}>
                    {c.label}
                    <kbd className="font-mono text-[10px] opacity-60">{c.key}</kbd>
                  </Button>
                ))}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
