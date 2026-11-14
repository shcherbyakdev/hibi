"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Item, Routine } from "@/lib/sync/db";
import { useSync } from "@/lib/sync/provider";
import { isLive } from "@/features/items/model";
import { EVERY_DAY } from "./model";

/** undefined = still reading; null = none (or deleted). */
export function useRoutine(id: string | null): Routine | null | undefined {
  const { db } = useSync();
  return useLiveQuery(async () => {
    if (!id) return null;
    const r = await db.routines.get(id);
    return r && isLive(r) ? r : null;
  }, [db, id]);
}

export function useGoalRoutines(goalId: string): Routine[] | undefined {
  const { db } = useSync();
  return useLiveQuery(
    async () => (await db.routines.filter((r) => isLive(r) && r.goal_id === goalId).toArray()).sort((a, b) => (a.created_at < b.created_at ? -1 : 1)),
    [db, goalId],
  );
}

const titleOf = (s: string) => s.trim().slice(0, 500);

export function useRoutineActions() {
  const { mutations: m } = useSync();
  return useMemo(
    () => ({
      /** The runner makes today's copy once the write lands. */
      async create(r: { title: string; priority?: number; goal_id?: string | null }, days = EVERY_DAY): Promise<string | null> {
        const title = titleOf(r.title);
        if (!title) return null;
        return m.insert("routines", { title, priority: r.priority ?? 0, goal_id: r.goal_id ?? null, days });
      },
      setDays: (r: Routine, days: number) => (days === r.days ? undefined : m.update("routines", r.id, { days })),
      rename(r: Routine, title: string) {
        const t = titleOf(title);
        if (t && t !== r.title) return m.update("routines", r.id, { title: t });
      },
      /** Stops future copies; past ones stay. */
      remove: (r: Routine) => m.remove("routines", r.id),
      /** Turns a task into a routine; the task counts as today's copy. */
      async fromTask(item: Item, days = EVERY_DAY): Promise<string> {
        const id = await m.insert("routines", { title: item.title, priority: item.priority, goal_id: item.goal_id, days });
        await m.update("items", item.id, { routine_id: id });
        return id;
      },
    }),
    [m],
  );
}
