"use client";

import { Pause, Play } from "lucide-react";
import type { Item } from "@/lib/sync/db";
import { clock, formatTotal } from "../model";
import { useNow, useTimer } from "../use-timer";

/** Row metadata: the tracked total, or — while this task's timer runs — its
    live total as an accent pill that pauses on click. Nothing if untracked. */
export function RowTime({ item }: { item: Item }) {
  const timer = useTimer();
  const isRunning = timer.running?.item_id === item.id;
  const now = useNow(isRunning);
  const total = timer.totalFor(item.id, isRunning ? now : undefined);

  if (isRunning)
    return (
      <button
        type="button"
        data-no-dnd
        tabIndex={-1}
        aria-label={`Pause timer for "${item.title}"`}
        onClick={() => void timer.pause()}
        className="text-brand-text bg-brand/10 hover:bg-brand/15 flex h-5 shrink-0 items-center gap-1 rounded-md px-1.5 font-mono text-[11px] tabular-nums"
      >
        <Pause className="size-3" /> {clock(total)}
      </button>
    );
  return total > 0 ? <span className="text-subtle shrink-0 font-mono text-[11px] tabular-nums">{formatTotal(total)}</span> : null;
}

/** Hover action: start this task's timer, or pause it while it runs. */
export function PlayButton({ item, className }: { item: Item; className?: string }) {
  const timer = useTimer();
  if (timer.running?.item_id === item.id)
    return (
      <button type="button" data-no-dnd tabIndex={-1} aria-label={`Pause timer for "${item.title}"`} title="Pause (S)" onClick={() => void timer.pause()} className={className}>
        <Pause className="size-3.5" />
      </button>
    );
  return (
    <button
      type="button"
      data-no-dnd
      tabIndex={-1}
      aria-label={`Start timer for "${item.title}"`}
      title="Start timer (S)"
      onClick={() => void timer.start(item.id)}
      className={className}
    >
      <Play className="size-3.5" />
    </button>
  );
}
