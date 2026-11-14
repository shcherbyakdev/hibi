"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Goal } from "@/lib/sync/db";
import { useToday } from "@/lib/use-today";
import { usePrefs } from "@/lib/prefs";
import { cn } from "@/lib/utils";
import { boardTone } from "@/features/boards/tone";
import { AddNamed } from "@/features/boards/components/inline-name";
import { dayCounts, streak, weekCount, type DayCounts } from "../model";
import { useAllGoalItems, useGoalActions, useGoals } from "../use-goals";
import { ContributionGrid } from "./contribution-grid";

/** Every goal with its recent grid, streak and this week's count. */
export function GoalsPage() {
  const goals = useGoals();
  const items = useAllGoalItems();
  const today = useToday();
  const actions = useGoalActions();
  const router = useRouter();
  if (!goals || !items || !today) return null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      {goals.length ? null : <p className="text-subtle px-3 text-[14px]">Set a goal, then add today&apos;s step toward it.</p>}
      {goals.map((g) => (
        <GoalCard key={g.id} goal={g} counts={dayCounts(items, g.id)} today={today} />
      ))}
      <AddNamed
        label="New goal"
        maxLength={120}
        className="px-3"
        onAdd={async (n) => {
          const id = await actions.create(n);
          if (id) router.push(`/goals/${id}`);
        }}
      />
    </div>
  );
}

export function GoalStats({ goal, counts, today }: { goal: Goal; counts: DayCounts; today: string }) {
  const { weekStart } = usePrefs();
  const s = streak(counts, today);
  return (
    <span className="text-subtle font-mono text-[11px] tracking-[0.06em] uppercase">
      {weekCount(counts, today, weekStart)}/{goal.weekly_target} this week{s ? ` · ${s}-day streak` : ""}
    </span>
  );
}

function GoalCard({ goal, counts, today }: { goal: Goal; counts: DayCounts; today: string }) {
  return (
    <section className="flex flex-col gap-3 border-b px-3 pb-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Link href={`/goals/${goal.id}`} className="flex min-w-0 items-center gap-2 text-[15px] outline-none hover:underline focus-visible:underline">
          <span aria-hidden className={cn("size-2 shrink-0 rounded-[1px] bg-current", boardTone(goal))} />
          <span className="truncate">{goal.name}</span>
        </Link>
        <GoalStats goal={goal} counts={counts} today={today} />
      </div>
      <ContributionGrid counts={counts} today={today} weeks={20} tone={boardTone(goal)} />
    </section>
  );
}
