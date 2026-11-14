"use client";

import { cn } from "@/lib/utils";
import { toneClass } from "@/lib/tone";
import { useGoal } from "../use-goals";

/** A small square in the goal's colour, in a task's metadata. Nothing if
    the goal is gone (deleted elsewhere, not synced yet). */
export function GoalDot({ id }: { id: string }) {
  const goal = useGoal(id);
  if (!goal) return null;
  return <span role="img" aria-label={`Goal: ${goal.name}`} title={goal.name} className={cn("size-1.5 shrink-0 rounded-[1px] bg-current", toneClass(goal))} />;
}
