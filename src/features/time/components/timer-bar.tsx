"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Pause, Play, X } from "lucide-react";
import { useSync } from "@/lib/sync/provider";
import { cn } from "@/lib/utils";
import { useItemSheet } from "@/features/items/components/item-sheet";
import { clock, formatTotal, sessionSeconds } from "../model";
import { useNow, useTimer } from "../use-timer";

const iconButton =
  "text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 flex size-6 items-center justify-center rounded-md outline-none focus-visible:ring-2";

/* The running timer, in the top bar on every page: task, its live total (or
   the pomodoro countdown with its ring), pause. After a pause it offers
   Resume for that task until dismissed. Also mirrors the clock into the tab
   title so a background tab still shows it. */
export function TimerBar() {
  const timer = useTimer();
  const sheet = useItemSheet();
  const { db } = useSync();
  const running = timer.running;
  const itemId = running?.item_id ?? timer.pausedItemId;
  const item = useLiveQuery(async () => (itemId ? ((await db.items.get(itemId)) ?? null) : null), [db, itemId]);
  const now = useNow(!!running);

  const session = running ? sessionSeconds(running, now) : 0;
  const left = running?.planned_seconds ? Math.max(0, running.planned_seconds - session) : null;
  // A pomodoro counts down; a plain timer shows the task's running total,
  // so a resumed task picks up where it left off.
  const display = left !== null ? clock(left) : clock(itemId ? timer.totalFor(itemId, now) : 0);

  React.useEffect(() => {
    if (!running || !item) return;
    const before = document.title;
    document.title = `${display} · ${item.title}`;
    return () => {
      document.title = before;
    };
  }, [running, item, display]);

  if (!itemId || !item || item.deleted_at) return null;

  if (!running)
    return (
      <div className="bg-muted flex h-7 items-center gap-1 rounded-md pr-0.5 pl-2.5 text-xs">
        <button type="button" onClick={() => sheet.open(item.id)} className="text-muted-foreground max-w-40 truncate outline-none hover:underline">
          {item.title}
        </button>
        <span className="text-subtle font-mono tabular-nums">{formatTotal(timer.totalFor(item.id))}</span>
        <button type="button" aria-label={`Resume timer for "${item.title}"`} title="Resume (S)" onClick={() => void timer.start(item.id)} className={iconButton}>
          <Play className="size-3.5" />
        </button>
        <button type="button" aria-label="Dismiss" onClick={timer.dismissPaused} className={iconButton}>
          <X className="size-3.5" />
        </button>
      </div>
    );

  return (
    <div role="timer" aria-label={`${left !== null ? "Pomodoro" : "Timer"} for ${item.title}`} className="bg-brand/10 flex h-7 items-center gap-1.5 rounded-md pr-0.5 pl-2 text-xs">
      {left !== null ? <Ring fraction={1 - left / running.planned_seconds!} /> : <span className="bg-primary size-1.5 rounded-[1px] motion-safe:animate-pulse" />}
      <button type="button" onClick={() => sheet.open(item.id)} className="max-w-40 truncate font-medium outline-none hover:underline">
        {item.title}
      </button>
      <span className={cn("text-brand-text min-w-9 font-mono tabular-nums", left !== null && "font-medium")}>{display}</span>
      <button type="button" aria-label="Pause timer" title="Pause (S)" onClick={() => void timer.pause()} className={iconButton}>
        <Pause className="size-3.5" />
      </button>
    </div>
  );
}

/** Pomodoro progress: a 14px ring filling clockwise. */
function Ring({ fraction }: { fraction: number }) {
  const c = 2 * Math.PI * 5;
  return (
    <svg viewBox="0 0 14 14" className="text-brand size-3.5 -rotate-90" aria-hidden>
      <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
      <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray={c} strokeDashoffset={c * (1 - fraction)} strokeLinecap="round" />
    </svg>
  );
}
