"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Goal, Item } from "@/lib/sync/db";
import { useSync } from "@/lib/sync/provider";
import { bySortKey, isLive, keyBetween } from "@/features/items/model";
import { nextTone } from "@/lib/tone";

export function useGoals(): Goal[] | undefined {
  const { db } = useSync();
  return useLiveQuery(async () => (await db.goals.filter(isLive).toArray()).sort(bySortKey), [db]);
}

/** undefined = still reading; null = no such (live) goal. */
export function useGoal(id: string): Goal | null | undefined {
  const { db } = useSync();
  return useLiveQuery(async () => {
    const g = await db.goals.get(id);
    return g && isLive(g) ? g : null;
  }, [db, id]);
}

/** Live tasks linked to a goal, in list order. */
export function useGoalItems(goalId: string): Item[] | undefined {
  const { db } = useSync();
  return useLiveQuery(async () => (await db.items.where("goal_id").equals(goalId).filter(isLive).toArray()).sort(bySortKey), [db, goalId]);
}

/** Every live task linked to any goal (the /goals overview). */
export function useAllGoalItems(): Item[] | undefined {
  const { db } = useSync();
  return useLiveQuery(() => db.items.where("goal_id").above("").filter(isLive).toArray(), [db]);
}

export function useGoalActions() {
  const { db, mutations: m } = useSync();
  return useMemo(
    () => ({
      /** New goal at the end, in the least-used colour. */
      async create(name: string): Promise<string | null> {
        const n = name.trim().slice(0, 120);
        if (!n) return null;
        const existing = (await db.goals.filter(isLive).toArray()).sort(bySortKey);
        return m.insert("goals", {
          name: n,
          notes: "",
          icon: nextTone(existing.map((g) => g.icon)),
          weekly_target: 5,
          sort_key: keyBetween(existing.at(-1)?.sort_key ?? null, null),
        });
      },
      edit(goal: Goal, patch: Partial<Pick<Goal, "name" | "notes" | "icon" | "weekly_target">>) {
        if (patch.name !== undefined) {
          patch = { ...patch, name: patch.name.trim().slice(0, 120) };
          if (!patch.name) return;
        }
        return m.update("goals", goal.id, patch);
      },
      /** Soft-deletes the goal and its routines (no more daily copies);
          its tasks stay, unlinked (the UI confirms). One transaction: the
          mutations' own transactions nest in it, so a crash can't leave a
          live goal half taken apart. */
      remove: (goal: Goal) =>
        db.transaction("rw", db.items, db.goals, db.routines, db.outbox, async () => {
          const items = await db.items.where("goal_id").equals(goal.id).toArray();
          for (const i of items) await m.update("items", i.id, { goal_id: null });
          const routines = await db.routines.filter((r) => r.goal_id === goal.id && isLive(r)).toArray();
          for (const r of routines) await m.remove("routines", r.id);
          await m.remove("goals", goal.id);
        }),
    }),
    [db, m],
  );
}
