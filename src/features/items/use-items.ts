"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { PlanScope } from "@/db/enums";
import type { Item, LocalDb } from "@/lib/sync/db";
import { useSync } from "@/lib/sync/provider";
import { periodOf } from "@/features/planner/periods";
import { bySortKey, isLive, isOpen, keyBetween, type Place, type Spot } from "./model";

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
  return useLiveQuery(async () => {
    if (!today) return [];
    const ranges = (["day", "week", "month"] as const).map((s) =>
      db.items.where("[plan_scope+plan_date]").between([s, ""], [s, periodOf(s, today)], true, false).filter((i) => isLive(i) && isOpen(i)).toArray(),
    );
    return (await Promise.all(ranges)).flat().sort((a, b) => (a.plan_date! < b.plan_date! ? -1 : a.plan_date! > b.plan_date! ? 1 : bySortKey(a, b)));
  }, [db, today]);
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
      /** New item at the end of a planner list, or of a board column. */
      async create(title: string, place: Place, spot?: Spot) {
        const text = title.trim();
        if (!text) return;
        await m.insert("items", {
          title: text.slice(0, 500),
          notes: "",
          status: "todo",
          priority: 0,
          ...place,
          board_id: spot?.board_id ?? null,
          column_id: spot?.column_id ?? null,
          sort_key: keyBetween(await lastKey(db, place, spot), null),
          done_at: null,
        });
      },
      rename(item: Item, title: string) {
        const text = title.trim().slice(0, 500);
        if (text && text !== item.title) return m.update("items", item.id, { title: text });
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
      /** Drop into a board column (null = "No column") between two neighbours. */
      moveToColumn(item: Item, column_id: string | null, prev: string | null, next: string | null) {
        return m.update("items", item.id, { column_id, sort_key: keyBetween(prev, next) });
      },
      remove: (item: Item) => m.remove("items", item.id),
    }),
    [db, m],
  );
}
