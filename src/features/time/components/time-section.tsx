"use client";

import { Pause, Play, Timer, X } from "lucide-react";
import type { Item } from "@/lib/sync/db";
import { Button } from "@/components/ui/button";
import { clock, formatTotal, sessionSeconds } from "../model";
import { useNow, useTimer } from "../use-timer";

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });

/** Details panel: total, start/pause, a 25-minute pomodoro, and the sessions. */
export function TimeSection({ item }: { item: Item }) {
  const timer = useTimer();
  const isRunning = timer.running?.item_id === item.id;
  const now = useNow(isRunning);
  const sessions = timer.entries.filter((e) => e.item_id === item.id);
  const total = timer.totalFor(item.id, now);
  const pomodoro = isRunning && !!timer.running!.planned_seconds;

  return (
    <div className="flex flex-col gap-2 border-t px-5 py-4">
      <div className="flex items-center gap-2">
        <span className="text-subtle w-16 shrink-0 font-mono text-[11px] uppercase tracking-[0.06em]">Time</span>
        <span className="text-[13px] font-medium tabular-nums">{isRunning ? clock(total) : total ? formatTotal(total) : "Not tracked"}</span>
        <div className="ml-auto flex gap-1.5">
          {isRunning ? (
            <Button size="sm" variant="secondary" onClick={() => void timer.pause()}>
              <Pause /> Pause{pomodoro ? " pomodoro" : ""}
            </Button>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={() => void timer.start(item.id)}>
                <Play /> {sessions.length ? "Continue" : "Start"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => void timer.start(item.id, { pomodoro: true })}>
                <Timer /> Pomodoro 25m
              </Button>
            </>
          )}
        </div>
      </div>
      {sessions.length ? (
        <ul className="ml-[4.75rem] flex max-h-40 flex-col overflow-y-auto text-xs">
          {sessions.map((s) => (
            <li key={s.id} className="group/s text-muted-foreground flex h-6 items-center gap-2">
              <span className="w-24">{dayFmt.format(new Date(s.started_at))}</span>
              <span className="tabular-nums">
                {timeFmt.format(new Date(s.started_at))}–{s.ended_at ? timeFmt.format(new Date(s.ended_at)) : "now"}
              </span>
              {s.planned_seconds ? <Timer aria-label="Pomodoro" className="size-3" /> : null}
              <span className="text-foreground ml-auto tabular-nums">{formatTotal(sessionSeconds(s, now))}</span>
              {s.ended_at ? (
                <button type="button" aria-label="Delete session" onClick={() => void timer.removeEntry(s)} className="hover:text-foreground opacity-0 group-hover/s:opacity-100 focus-visible:opacity-100">
                  <X className="size-3" />
                </button>
              ) : (
                <span className="w-3" />
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
