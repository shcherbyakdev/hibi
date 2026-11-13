import type { PlanScope } from "@/db/enums";

/* Calendar math on local "YYYY-MM-DD" strings — the same shape plan_date
   has in Postgres and IndexedDB. Never toISOString(): that is UTC and
   lands a day early east of GMT. Date objects are built at local noon, so a
   DST shift can't push them across midnight. */

/** 0 = Sunday, 1 = Monday. The default; the user's choice comes from
    usePrefs() and is passed to every function that needs it. */
export const WEEK_START: 0 | 1 = 1;

const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(s: string, n: number): string {
  const d = fromISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function startOfMonth(s: string): string {
  return `${s.slice(0, 7)}-01`;
}

export function addMonths(monthStart: string, n: number): string {
  const d = fromISODate(startOfMonth(monthStart));
  d.setMonth(d.getMonth() + n);
  return toISODate(d);
}

export function startOfWeek(s: string, weekStart = WEEK_START): string {
  const back = (fromISODate(s).getDay() - weekStart + 7) % 7;
  return addDays(s, -back);
}

export function weekDays(weekStartDate: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));
}

/** Whole weeks covering the month, as rows of 7 dates. */
export function monthGrid(monthStart: string, weekStart = WEEK_START): string[][] {
  const last = addDays(addMonths(monthStart, 1), -1);
  const weeks: string[][] = [];
  for (let w = startOfWeek(monthStart, weekStart); w <= last; w = addDays(w, 7)) weeks.push(weekDays(w));
  return weeks;
}

/** The plan_date an item gets when planned for `scope` around `date`. */
export function periodOf(scope: PlanScope, date: string, weekStart = WEEK_START): string {
  return scope === "day" ? date : scope === "week" ? startOfWeek(date, weekStart) : startOfMonth(date);
}

type Planned = { plan_scope: PlanScope | null; plan_date: string | null; status: string };

/** Open, and its whole day / week / month is behind us. */
export function isOverdue(item: Planned, today: string, weekStart = WEEK_START): boolean {
  if (!item.plan_scope || !item.plan_date || item.status === "done" || item.status === "dropped") return false;
  return item.plan_date < periodOf(item.plan_scope, today, weekStart);
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(undefined, opts);
const dayLong = fmt({ weekday: "long", month: "long", day: "numeric" });
const dayShort = fmt({ weekday: "short", month: "short", day: "numeric" });
const weekday = fmt({ weekday: "short" });
const monthYear = fmt({ month: "long", year: "numeric" });
const weekdayLong = fmt({ weekday: "long" });
const dayMonth = fmt({ month: "long", day: "numeric" });
const monthName = fmt({ month: "long" });
const monthDay = fmt({ month: "short", day: "numeric" });

export const label = {
  dayLong: (s: string) => dayLong.format(fromISODate(s)),
  dayShort: (s: string) => dayShort.format(fromISODate(s)),
  weekday: (s: string) => weekday.format(fromISODate(s)),
  dayOfMonth: (s: string) => String(Number(s.slice(8))),
  month: (s: string) => monthYear.format(fromISODate(s)),
  weekdayLong: (s: string) => weekdayLong.format(fromISODate(s)),
  dayMonth: (s: string) => dayMonth.format(fromISODate(s)),
  monthName: (s: string) => monthName.format(fromISODate(s)),
  year: (s: string) => s.slice(0, 4),
  week: (start: string) => `${monthDay.format(fromISODate(start))} – ${monthDay.format(fromISODate(addDays(start, 6)))}`,
};
