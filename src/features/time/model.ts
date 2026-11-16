import type { TimeEntry } from "@/lib/sync/db";

/** The fields the math needs (tests pass partial rows). */
export type Session = Pick<TimeEntry, "id" | "item_id" | "started_at" | "ended_at" | "planned_seconds" | "deleted_at">;

export const POMODORO_SECONDS = 25 * 60;

const ms = (iso: string) => Date.parse(iso);

/** Seconds a session counts at `now` (epoch ms). A pomodoro never counts
    more than planned, even if it was left running with the app closed. */
export function sessionSeconds(e: Session, now: number): number {
  const end = e.ended_at ? ms(e.ended_at) : now;
  const s = Math.max(0, (end - ms(e.started_at)) / 1000);
  return Math.floor(e.planned_seconds ? Math.min(s, e.planned_seconds) : s);
}

export function totalsByItem(entries: Session[], now: number): Map<string, number> {
  const totals = new Map<string, number>();
  for (const e of entries) if (!e.deleted_at) totals.set(e.item_id, (totals.get(e.item_id) ?? 0) + sessionSeconds(e, now));
  return totals;
}

export const isRunning = (e: Session) => !e.ended_at && !e.deleted_at;

/** The running sessions that should be closed now, and where:
    - a pomodoro past its length ends at exactly started_at + planned;
    - with several running (timers started on two devices), the newest is
      the timer and the others end where it began. */
export function dueToClose(entries: Session[], now: number): Array<{ id: string; ended_at: string; reason: "pomodoro" | "superseded" }> {
  const running = entries.filter(isRunning).sort((a, b) => ms(b.started_at) - ms(a.started_at));
  const due: Array<{ id: string; ended_at: string; reason: "pomodoro" | "superseded" }> = [];
  running.forEach((e, i) => {
    const pomodoroEnd = e.planned_seconds ? ms(e.started_at) + e.planned_seconds * 1000 : Infinity;
    const supersededAt = i === 0 ? Infinity : Math.max(ms(e.started_at), ms(running[0].started_at));
    const end = Math.min(pomodoroEnd, supersededAt);
    if (end <= now) due.push({ id: e.id, ended_at: new Date(end).toISOString(), reason: end === pomodoroEnd ? "pomodoro" : "superseded" });
  });
  return due;
}

const two = (n: number) => String(n).padStart(2, "0");

/** A running clock: 1:05, 12:00, 1:02:03. */
export function clock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

/** A total: <1m, 25m, 1h 25m, 2h. */
export function formatTotal(seconds: number): string {
  if (seconds < 60) return "<1m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

// ponytail: a fixed daily focus goal; becomes a pref when someone wants to change it.
export const FOCUS_GOAL_SECONDS = 4 * 3600;

const startedIn = (e: Session, dayStart: number, dayEnd: number) => {
  const s = ms(e.started_at);
  return !e.deleted_at && s >= dayStart && s < dayEnd;
};

/** Pomodoros on a task, started in [dayStart, dayEnd), that ran their full length. */
export function pomodorosDone(entries: Session[], itemId: string, dayStart: number, dayEnd: number, now: number): number {
  return entries.filter((e) => e.item_id === itemId && e.planned_seconds && startedIn(e, dayStart, dayEnd) && sessionSeconds(e, now) >= e.planned_seconds).length;
}

/** Seconds tracked (timers and pomodoros) by sessions started in [dayStart, dayEnd). */
export function focusSeconds(entries: Session[], dayStart: number, dayEnd: number, now: number): number {
  return entries.reduce((sum, e) => sum + (startedIn(e, dayStart, dayEnd) ? sessionSeconds(e, now) : 0), 0);
}
