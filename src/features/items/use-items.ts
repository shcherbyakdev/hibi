"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { PlanScope } from "@/db/enums";
import type { Item, LocalDb } from "@/lib/sync/db";
import { useSync } from "@/lib/sync/provider";
import { usePrefs } from "@/lib/prefs";
import { toast } from "sonner";
import { periodOf } from "@/features/planner/periods";
import { bySortKey, INBOX, isLive, isOpen, keyBetween, parseQuickTitle, type Place, type Spot } from "./model";

/* Reads are live IndexedDB queries: they re-render on every local write and
   every pulled change. `undefined` means "first read not back yet" (a few
   ms) — views render nothing then, never a spinner. */

const planned = (db: LocalDb, scope: PlanScope, from: string, to: string) =>
  db.items.where("[plan_scope+plan_date]").between([scope, from], [scope, to], true, true).filter(isLive).toArray();

/** Items planned for `scope` with plan_date in [from, to], in list order. */
export function usePlanned(scope: PlanScope, from: string, to: string = from): Item[] | undefined {
  const { db } = useSync();
  return useLiveQuery(async () => (await planned(db, scope, from, to)).sort(bySortKey), [db, scope, from, to]);
}

/** Open items whose whole period ended before today's (any scope). */
export function useOverdue(today: string | null): Item[] | undefined {
  const { db } = useSync();
  const { weekStart } = usePrefs();
  return useLiveQuery(async () => {
    if (!today) return [];
    const ranges = (["day", "week", "month"] as const).map((s) =>
      db.items.where("[plan_scope+plan_date]").between([s, ""], [s, periodOf(s, today, weekStart)], true, false).filter((i) => isLive(i) && isOpen(i)).toArray(),
    );
    return (await Promise.all(ranges)).flat().sort((a, b) => (a.plan_date! < b.plan_date! ? -1 : a.plan_date! > b.plan_date! ? 1 : bySortKey(a, b)));
  }, [db, today, weekStart]);
}

/** Unplanned and on no board. ponytail: a filtered scan (IndexedDB can't
    index nulls); fine to tens of thousands of rows. */
export function useInbox(): Item[] | undefined {
  const { db } = useSync();
  return useLiveQuery(
    async () => (await db.items.filter((i) => isLive(i) && !i.plan_scope && !i.board_id).toArray()).sort(bySortKey),
    [db],
  );
}

/** Last key of the list a place (or a board column) shows, so new and moved
    items go to its end. */
async function lastKey(db: LocalDb, p: Place, spot?: Spot): Promise<string | null> {
  const rows = spot
    ? await db.items.where("board_id").equals(spot.board_id).filter((i) => isLive(i) && i.column_id === spot.column_id).toArray()
    : p.plan_scope
    ? await planned(db, p.plan_scope, p.plan_date!, p.plan_date!)
    : await db.items.filter((i) => isLive(i) && !i.plan_scope && !i.board_id).toArray();
  return rows.reduce<string | null>((max, r) => (max === null || r.sort_key > max ? r.sort_key : max), null);
}

export function useItemActions() {
  const { db, mutations: m } = useSync();
  return useMemo(
    () => ({
      /** New item at the end of a planner list, or of a board column.
          A picked priority wins; otherwise "!1"–"!4" in the title sets it. */
      async create(raw: string, place: Place, spot?: Spot, picked = 0, goalId: string | null = null) {
        if (!raw.trim()) return;
        const parsed = parseQuickTitle(raw);
        const { title } = parsed;
        const priority = picked || parsed.priority;
        await m.insert("items", {
          title: title.slice(0, 500),
          notes: "",
          status: "todo",
          priority,
          ...place,
          board_id: spot?.board_id ?? null,
          column_id: spot?.column_id ?? null,
          goal_id: goalId,
          sort_key: keyBetween(await lastKey(db, place, spot), null),
          done_at: null,
        });
      },
      rename(item: Item, title: string) {
        const text = title.trim().slice(0, 500);
        if (text && text !== item.title) return m.update("items", item.id, { title: text });
      },
      /** done_at follows status into and out of "done". */
      setStatus(item: Item, status: Item["status"]) {
        if (status === item.status) return;
        return m.update("items", item.id, { status, done_at: status === "done" ? new Date().toISOString() : null });
      },
      edit: (item: Item, patch: Pick<Partial<Item>, "notes" | "priority">) => m.update("items", item.id, patch),
      setGoal: (item: Item, goalId: string | null) => m.update("items", item.id, { goal_id: goalId }),
      /** Onto a board column (end of it), or off boards with null. */
      async moveToBoard(item: Item, spot: Spot | null) {
        if (!spot) return m.update("items", item.id, { board_id: null, column_id: null });
        if (item.board_id === spot.board_id && item.column_id === spot.column_id) return;
        await m.update("items", item.id, { ...spot, sort_key: keyBetween(await lastKey(db, INBOX, spot), null) });
      },
      toggleDone(item: Item) {
        const done = item.status !== "done";
        return m.update("items", item.id, { status: done ? "done" : "todo", done_at: done ? new Date().toISOString() : null });
      },
      /** Plan for a place (or unplan with INBOX); lands at the end of that list. */
      async plan(item: Item, place: Place) {
        if (item.plan_scope === place.plan_scope && item.plan_date === place.plan_date) return;
        await m.update("items", item.id, { ...place, sort_key: keyBetween(await lastKey(db, place), null) });
      },
      /** Drop between two neighbours (their sort keys) in a place's list. */
      move(item: Item, place: Place, prev: string | null, next: string | null) {
        return m.update("items", item.id, { ...place, sort_key: keyBetween(prev, next) });
      },
      /** A new position within the same list (keyboard reorder). */
      reorder: (item: Item, sort_key: string) => m.update("items", item.id, { sort_key }),
      /** Drop into a board column (null = "No column") between two neighbours. */
      moveToColumn(item: Item, column_id: string | null, prev: string | null, next: string | null) {
        return m.update("items", item.id, { column_id, sort_key: keyBetween(prev, next) });
      },
      /** Soft delete with an Undo toast. */
      async remove(item: Item) {
        await m.remove("items", item.id);
        toast(`Deleted “${item.title}”`, { action: { label: "Undo", onClick: () => void m.restore("items", item.id) } });
      },
    }),
    [db, m],
  );
}
