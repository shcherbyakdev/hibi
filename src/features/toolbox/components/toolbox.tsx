"use client";

import * as React from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowUpRight, Pause, PanelRight, PictureInPicture2, Play, Plus, RotateCcw, X } from "lucide-react";
import type { Item } from "@/lib/sync/db";
import { useSync } from "@/lib/sync/provider";
import { cn } from "@/lib/utils";
import { useToday } from "@/lib/use-today";
import { isOpen } from "@/features/items/model";
import { useItemActions, usePlanned } from "@/features/items/use-items";
import { useItemSheet } from "@/features/items/components/item-sheet";
import { addDays, fromISODate } from "@/features/planner/periods";
import { clock, FOCUS_GOAL_SECONDS, focusSeconds, POMODORO_SECONDS, pomodorosDone, sessionSeconds } from "@/features/time/model";
import { useNow, useTimer } from "@/features/time/use-timer";
import { useToolbox } from "../use-toolbox";
import { TickRing } from "./tick-ring";

const iconButton =
  "text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-2";
const label = "text-muted-foreground font-mono text-[11px] uppercase tracking-[0.06em]";
const card = "bg-background rounded-md border";

/** Local midnight of an ISO date, as epoch ms. */
const midnight = (iso: string) => fromISODate(iso).setHours(0, 0, 0, 0);

/* The toolbox card: today's tasks to focus on, the running pomodoro, and
   today's focus time. A view over useTimer() — it never keeps timer state of
   its own, so it can't disagree with the top bar. Placement is the host's. */
export function Toolbox({ dragHandleProps }: { dragHandleProps?: React.HTMLAttributes<HTMLElement> }) {
  const today = useToday();
  const timer = useTimer();
  const now = useNow(!!timer.running);
  const box = useToolbox();
  if (!today) return null;
  const day = [midnight(today), midnight(addDays(today, 1))] as const;

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className={cn(card, "flex flex-col")}>
        <header {...dragHandleProps} className={cn("flex items-center gap-1 px-3 pt-2.5 pb-1", dragHandleProps && "cursor-grab touch-none active:cursor-grabbing")}>
          <Link href="/plan/day" className="hover:text-foreground flex items-center gap-1 rounded-md text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
            Today <ArrowUpRight className="text-muted-foreground size-3.5" aria-hidden />
          </Link>
          <div className="ml-auto flex items-center">
            {box.mode === "docked" ? (
              <button type="button" aria-label="Float toolbox" title="Float" onClick={() => box.setMode("floating")} className={iconButton}>
                <PictureInPicture2 className="size-3.5" />
              </button>
            ) : (
              <button type="button" aria-label="Dock toolbox" title="Dock" onClick={() => box.setMode("docked")} className={cn(iconButton, "max-md:hidden")}>
                <PanelRight className="size-3.5" />
              </button>
            )}
            <button type="button" aria-label="Hide toolbox" title="Hide (F)" onClick={() => box.setMode("hidden")} className={iconButton}>
              <X className="size-3.5" />
            </button>
          </div>
        </header>
        <TodayTasks today={today} day={day} now={now} />
      </div>
      <TimerCard now={now} />
      <FocusCard seconds={focusSeconds(timer.entries, ...day, now)} />
    </div>
  );
}

function TodayTasks({ today, day, now }: { today: string; day: readonly [number, number]; now: number }) {
  const items = usePlanned("day", today)?.filter(isOpen);
  const actions = useItemActions();
  const [adding, setAdding] = React.useState(false);
  const [text, setText] = React.useState("");
  const add = async () => {
    await actions.create(text, { plan_scope: "day", plan_date: today });
    setText("");
  };

  return (
    <div className="flex flex-col gap-1 px-1.5 pb-1.5">
      {items?.map((item) => <TaskRow key={item.id} item={item} day={day} now={now} />)}
      {items && !items.length && !adding ? <p className="text-subtle px-1.5 py-2 text-xs">Nothing planned for today</p> : null}
      {adding ? (
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void add();
            if (e.key === "Escape") {
              e.stopPropagation(); // closes the input, not the floating card
              setAdding(false);
              setText("");
            }
          }}
          onBlur={() => !text.trim() && setAdding(false)}
          placeholder="New task for today"
          aria-label="New task for today"
          className="bg-muted/50 placeholder:text-subtle h-9 rounded-md px-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="text-muted-foreground hover:text-foreground hover:bg-muted flex h-8 items-center gap-1.5 rounded-md px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
          <Plus className="size-3.5" aria-hidden /> Add
        </button>
      )}
    </div>
  );
}

function TaskRow({ item, day, now }: { item: Item; day: readonly [number, number]; now: number }) {
  const timer = useTimer();
  const sheet = useItemSheet();
  const running = timer.running?.item_id === item.id ? timer.running : null;
  const done = pomodorosDone(timer.entries, item.id, ...day, now);
  const left = running?.planned_seconds ? Math.max(0, running.planned_seconds - sessionSeconds(running, now)) : null;

  return (
    <div className="bg-muted/50 flex items-center gap-2 rounded-md py-2 pr-2 pl-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <button type="button" onClick={() => sheet.open(item.id)} className="truncate text-left outline-none hover:underline focus-visible:underline">
          {item.title}
        </button>
        <Dashes done={done} />
      </div>
      {running ? (
        <>
          <span className="text-muted-foreground font-mono text-xs tabular-nums">{clock(left ?? sessionSeconds(running, now))}</span>
          <button type="button" aria-label={`Pause "${item.title}"`} onClick={() => void timer.pause()} className="ring-brand bg-muted hover:bg-muted/70 flex size-8 items-center justify-center rounded-md ring-1 outline-none focus-visible:ring-2">
            <Pause className="size-3.5" />
          </button>
        </>
      ) : (
        <button type="button" aria-label={`Start a pomodoro on "${item.title}"`} onClick={() => void timer.start(item.id, { pomodoro: true })} className="bg-muted hover:bg-muted/70 flex size-8 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
          <Play className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** Four slots, lit per finished pomodoro today; ×n past four. */
function Dashes({ done }: { done: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${done} pomodoro${done === 1 ? "" : "s"} today`}>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className={cn("h-0.5 w-4 rounded-full", i < done ? "bg-brand" : "bg-foreground/15")} />
      ))}
      {done > 4 ? <span className="text-brand-text font-mono text-[10px] tabular-nums">×{done}</span> : null}
    </div>
  );
}

function TimerCard({ now }: { now: number }) {
  const timer = useTimer();
  const { db } = useSync();
  const running = timer.running;
  const itemId = running?.item_id ?? timer.pausedItemId;
  const item = useLiveQuery(async () => (itemId ? ((await db.items.get(itemId)) ?? null) : null), [db, itemId]);
  const session = running ? sessionSeconds(running, now) : 0;
  const planned = running?.planned_seconds ?? null;
  const display = running ? clock(planned ? Math.max(0, planned - session) : session) : clock(POMODORO_SECONDS);
  const title = item && !item.deleted_at ? item.title : null;

  return (
    <div className={cn(card, "flex flex-col gap-3 p-3")}>
      <div className="mx-auto w-full max-w-56">
        <TickRing fraction={planned ? session / planned : 0}>
          <span role="timer" aria-label={running ? `${planned ? "Pomodoro" : "Timer"}${title ? ` for ${title}` : ""}` : "Pomodoro"} className={cn("font-mono text-5xl tabular-nums", !running && "text-muted-foreground")}>
            {display}
          </span>
          <span className="text-subtle mt-1 max-w-36 truncate text-xs">{title ?? (running ? "" : "Pick a task")}</span>
        </TickRing>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          aria-label="Restart pomodoro"
          disabled={!running}
          onClick={() => running && void timer.start(running.item_id, { pomodoro: true })}
          className="hover:bg-muted flex h-10 items-center justify-center rounded-md border outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-40"
        >
          <RotateCcw className="size-4" />
        </button>
        <button
          type="button"
          aria-label={running ? "Pause" : "Resume"}
          disabled={!running && !timer.pausedItemId}
          onClick={() => void (running ? timer.pause() : timer.pausedItemId && timer.start(timer.pausedItemId, { pomodoro: true }))}
          className="bg-muted hover:bg-muted/70 flex h-10 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-40"
        >
          {running ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
      </div>
    </div>
  );
}

function FocusCard({ seconds }: { seconds: number }) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const unit = "text-muted-foreground ml-0.5 mr-1.5 text-lg";
  return (
    <div className={cn(card, "flex flex-col gap-3 p-3")}>
      <span className={label}>Focus time</span>
      <p className="font-mono text-4xl tabular-nums" aria-label={`${h} hours ${m} minutes`}>
        {h ? (
          <>
            {h}
            <span className={unit}>h</span>
          </>
        ) : null}
        {m}
        <span className={unit}>m</span>
      </p>
      <span className="text-subtle text-xs">Goal: {FOCUS_GOAL_SECONDS / 3600} hours</span>
    </div>
  );
}
