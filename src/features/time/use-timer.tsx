"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import type { TimeEntry } from "@/lib/sync/db";
import { useSync } from "@/lib/sync/provider";
import { dueToClose, isRunning, POMODORO_SECONDS, sessionSeconds, totalsByItem } from "./model";

type Timer = {
  /** Every live session (newest first). */
  entries: TimeEntry[];
  /** The running session, if any. */
  running: TimeEntry | null;
  /** Last paused task on this device, for "Resume". */
  pausedItemId: string | null;
  /** Tracked seconds per task, as of `at`. Live callers pass useNow(). */
  totalFor: (itemId: string, at?: number) => number;
  start: (itemId: string, opts?: { pomodoro?: boolean }) => Promise<void>;
  pause: () => Promise<void>;
  dismissPaused: () => void;
  removeEntry: (entry: TimeEntry) => Promise<void>;
};

const TimerContext = React.createContext<Timer | null>(null);

export function useTimer(): Timer {
  const t = React.use(TimerContext);
  if (!t) throw new Error("useTimer outside <TimerProvider>");
  return t;
}

/** Re-renders every second while `active`; returns epoch ms. */
export function useNow(active: boolean): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

// Per device: the task you paused, so the bar can offer Resume after a reload.
// An external store (localStorage + an in-tab event) so every reader agrees.
const PAUSED_KEY = "todo:paused-item";
const PAUSED_EVENT = "todo:paused-change";
const readPaused = () => {
  try {
    return localStorage.getItem(PAUSED_KEY);
  } catch {
    return null;
  }
};
const writePaused = (id: string | null) => {
  try {
    if (id) localStorage.setItem(PAUSED_KEY, id);
    else localStorage.removeItem(PAUSED_KEY);
  } catch {}
  window.dispatchEvent(new Event(PAUSED_EVENT));
};
const subscribePaused = (cb: () => void) => {
  window.addEventListener(PAUSED_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(PAUSED_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};

/* Timer sessions are synced rows (time_entries): starting writes a row with
   no ended_at, pausing writes ended_at. Everything else is derived, so the
   timer survives reloads, closed tabs and switching devices. */
export function TimerProvider({ children }: { children: React.ReactNode }) {
  const { db, mutations: m } = useSync();
  // `readAt` is when the query ran: totals for stopped sessions don't depend
  // on the clock, and live callers pass their own ticking `now`.
  const { entries, readAt } = useLiveQuery(
    async () => ({
      entries: (await db.time_entries.filter((e) => e.deleted_at === null).toArray()).sort((a, b) => (a.started_at < b.started_at ? 1 : -1)),
      readAt: Date.now(),
    }),
    [db],
    { entries: [] as TimeEntry[], readAt: 0 },
  );
  const running = entries.find(isRunning) ?? null;
  const pausedItemId = React.useSyncExternalStore(subscribePaused, readPaused, () => null);
  const remember = writePaused;

  // Close what's due: finished pomodoros (toast + notification) and timers
  // superseded by a newer one from another device. `closing` stops a second
  // tick from closing the same row before the live query catches up.
  const closing = React.useRef(new Set<string>());
  const anyRunning = entries.some(isRunning);
  React.useEffect(() => {
    if (!anyRunning) return;
    const tick = async () => {
      for (const d of dueToClose(entries, Date.now())) {
        if (closing.current.has(d.id)) continue;
        closing.current.add(d.id);
        await m.update("time_entries", d.id, { ended_at: d.ended_at });
        if (d.reason === "pomodoro") {
          const entry = entries.find((e) => e.id === d.id);
          const item = entry ? await db.items.get(entry.item_id) : undefined;
          const title = item?.title ?? "your task";
          if (entry) remember(entry.item_id);
          toast.success(`Pomodoro done · ${title}`, { description: "Take a 5-minute break.", duration: 10_000 });
          if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
            new Notification("Pomodoro done", { body: `${title} — take a 5-minute break.` });
          }
        }
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 1000);
    return () => clearInterval(id);
  }, [anyRunning, entries, db, m, remember]);

  const value = React.useMemo<Timer>(() => {
    const totals = totalsByItem(entries, readAt);
    const stopRunning = async (at: number) => {
      for (const r of entries.filter(isRunning)) {
        // Never past a pomodoro's planned end.
        const end = r.planned_seconds ? Math.min(at, Date.parse(r.started_at) + r.planned_seconds * 1000) : at;
        await m.update("time_entries", r.id, { ended_at: new Date(Math.max(end, Date.parse(r.started_at))).toISOString() });
      }
    };
    return {
      entries,
      running,
      pausedItemId,
      totalFor: (itemId, at) =>
        at === undefined ? (totals.get(itemId) ?? 0) : entries.filter((e) => e.item_id === itemId).reduce((s, e) => s + sessionSeconds(e, at), 0),
      async start(itemId, opts) {
        const now = Date.now();
        await stopRunning(now);
        remember(null);
        if (opts?.pomodoro && typeof Notification !== "undefined" && Notification.permission === "default") {
          // Asked on the click that starts the first pomodoro, never on load.
          void Notification.requestPermission();
        }
        await m.insert("time_entries", {
          item_id: itemId,
          started_at: new Date(now).toISOString(),
          ended_at: null,
          planned_seconds: opts?.pomodoro ? POMODORO_SECONDS : null,
        });
      },
      async pause() {
        if (!running) return;
        await stopRunning(Date.now());
        remember(running.item_id);
      },
      dismissPaused: () => remember(null),
      removeEntry: (entry) => m.remove("time_entries", entry.id),
    };
  }, [entries, readAt, running, pausedItemId, m, remember]);

  return <TimerContext value={value}>{children}</TimerContext>;
}
