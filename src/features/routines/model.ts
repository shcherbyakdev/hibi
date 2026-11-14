import { fromISODate } from "@/features/planner/periods";

/* A routine's weekdays as a bitmask: bit 0 = Sunday … bit 6 = Saturday
   (Date#getDay order), so 127 = every day. Stored in routines.days. */
export const EVERY_DAY = 127;
export const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"] as const;
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** The bit for a local calendar date's weekday. */
export const dayBit = (date: string) => 1 << fromISODate(date).getDay();

export const isDue = (days: number, date: string) => (days & dayBit(date)) !== 0;

/** Flip one weekday (0–6); the last day left can't be cleared. */
export function toggleDay(days: number, weekday: number): number {
  const next = days ^ (1 << weekday);
  return next === 0 ? days : next;
}

/** Weekday indices in display order for the week-start setting. */
export const dayOrder = (weekStart: 0 | 1) => Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7);

/** updated_at of a generated copy: older than any real edit, so a tick,
    rename or delete always wins last-write-wins against a copy another
    device generated later (server trigger and client pull alike). */
export const GENERATED_STAMP = "2000-01-01T00:00:00.000Z";

/** The id of a routine's copy for a date: the same on every device, so two
    devices making today's copy make one row. SHA-1, UUID v5 layout. */
export async function occurrenceId(routineId: string, date: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(`${routineId}:${date}`)));
  const b = hash.slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
