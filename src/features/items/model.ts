import { generateKeyBetween } from "fractional-indexing";
import type { PlanScope } from "@/db/enums";
import type { Item } from "@/lib/sync/db";
import { label } from "@/features/planner/periods";

export const isOpen = (i: Pick<Item, "status">) => i.status === "todo" || i.status === "doing";
export const isLive = (i: Pick<Item, "deleted_at">) => i.deleted_at === null;

/** Byte order, which is what fractional-indexing keys are designed for
    (localeCompare would not be). */
export const bySortKey = (a: { sort_key: string }, b: { sort_key: string }) =>
  a.sort_key < b.sort_key ? -1 : a.sort_key > b.sort_key ? 1 : 0;

/** A key strictly between two neighbours. ponytail: two devices appending to
    the same list offline can mint equal keys; then we fall back to "after
    prev", which may misplace one item by a slot until it's dragged again. */
export function keyBetween(prev: string | null, next: string | null): string {
  if (prev !== null && next !== null && prev >= next) return generateKeyBetween(prev, null);
  return generateKeyBetween(prev, next);
}

/** New key for the row at `i` after one step left (-1) or right (+1) in a
    sorted list; null when it can't move. It lands between the neighbour it
    passes and the one beyond. */
export function keyForStep(list: { sort_key: string }[], i: number, dir: -1 | 1): string | null {
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return null;
  return dir === 1
    ? keyBetween(list[j].sort_key, list[j + 1]?.sort_key ?? null)
    : keyBetween(list[j - 1]?.sort_key ?? null, list[j].sort_key);
}

/** Where an item is planned. null scope = unplanned (the Inbox, if it's on
    no board either). */
export type Place = { plan_scope: PlanScope | null; plan_date: string | null };
export const INBOX: Place = { plan_scope: null, plan_date: null };

/** Where an item sits on a board. column_id null = the "No column" group.
    ponytail: an item has ONE sort_key, shared by its planner list and its
    board column, so reordering in one can shuffle it in the other. Split
    into two keys if that ever feels wrong. */
export type Spot = { board_id: string; column_id: string | null };

/** Drag-and-drop group ids are places: "day:2026-11-13", "week:…", "inbox". */
export const placeId = (p: Place) => (p.plan_scope ? `${p.plan_scope}:${p.plan_date}` : "inbox");
export function parsePlaceId(id: string): Place | null {
  if (id === "inbox") return INBOX;
  const m = /^(day|week|month):(\d{4}-\d{2}-\d{2})$/.exec(id);
  return m ? { plan_scope: m[1] as PlanScope, plan_date: m[2] } : null;
}

export function placeLabel(p: Place): string {
  if (!p.plan_scope || !p.plan_date) return "Unplanned";
  if (p.plan_scope === "day") return label.dayShort(p.plan_date);
  if (p.plan_scope === "week") return `Week of ${label.week(p.plan_date)}`;
  return label.month(p.plan_date);
}
