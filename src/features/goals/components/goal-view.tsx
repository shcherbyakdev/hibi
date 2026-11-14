"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { Check } from "lucide-react";
import type { Goal, Item } from "@/lib/sync/db";
import { useToday } from "@/lib/use-today";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { PageActions } from "@/components/shell/page-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BOARD_TONES, boardTone, type BoardToneKey } from "@/features/boards/tone";
import { InlineName } from "@/features/boards/components/inline-name";
import { GroupHeader } from "@/features/planner/components/planner-board";
import { ItemRow } from "@/features/items/components/item-row";
import { QuickAdd } from "@/features/items/components/quick-add";
import { isOpen } from "@/features/items/model";
import { dayCounts, weekCount } from "../model";
import { usePrefs } from "@/lib/prefs";
import { SEGMENTED_NAV_CLASS, segmentedItemClass } from "@/components/ui/segmented";
import { useGoal, useGoalActions, useGoalItems } from "../use-goals";
import { ContributionGrid } from "./contribution-grid";
import { GoalStats } from "./goals-page";

const RECENT = 10;

export function GoalView({ id }: { id: string }) {
  const goal = useGoal(id);
  const items = useGoalItems(id);
  const today = useToday();
  const { weekStart } = usePrefs();
  const actions = useGoalActions();
  if (goal === undefined || !items || !today) return null;
  if (goal === null) return <EmptyState title="Goal not found">It may have been deleted, or it hasn&apos;t synced to this device yet.</EmptyState>;

  const counts = dayCounts(items, goal.id);
  const open = items.filter(isOpen);
  const done = items.filter((i) => i.done_at).sort((a, b) => (a.done_at! < b.done_at! ? 1 : -1)).slice(0, RECENT);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <PageActions>
        <GoalMenu goal={goal} taskCount={items.length} />
      </PageActions>
      <div className="flex flex-col gap-1 px-3">
        <h2 className="flex items-center gap-2 text-[22px] font-normal tracking-[-0.03em]">
          <span aria-hidden className={cn("size-2.5 shrink-0 rounded-[1px] bg-current", boardTone(goal))} />
          <InlineName value={goal.name} label="goal" maxLength={120} onSave={(n) => actions.edit(goal, { name: n })} />
        </h2>
        <GoalStats goal={goal} counts={counts} today={today} />
      </div>

      <WeeklyAim goal={goal} done={weekCount(counts, today, weekStart)} />

      <div className="px-3">
        <ContributionGrid counts={counts} today={today} weeks={53} tone={boardTone(goal)} />
      </div>

      <Notes key={goal.id} goal={goal} />

      <QuickAdd place={{ plan_scope: "day", plan_date: today }} goalId={goal.id} placeholder="Add a step for today" className="h-11 gap-3 px-3 text-[14px]" />

      <TaskList title="Open" items={open} today={today} />
      {done.length ? <TaskList title="Done recently" items={done} today={today} /> : null}
    </div>
  );
}

const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** Days a week to aim for (1–7), with this week's progress under it: one
    segment per aimed day, filled in the goal's tone as days get done. */
function WeeklyAim({ goal, done }: { goal: Goal; done: number }) {
  const actions = useGoalActions();
  return (
    <div className="flex flex-col gap-2 px-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span id="weekly-aim" className="text-subtle font-mono text-[11px] tracking-[0.06em] uppercase">
          Weekly aim
        </span>
        <div role="radiogroup" aria-labelledby="weekly-aim" className={SEGMENTED_NAV_CLASS}>
          {DAYS.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={n === goal.weekly_target}
              aria-label={`${n} ${n === 1 ? "day" : "days"} a week`}
              onClick={() => actions.edit(goal, { weekly_target: n })}
              className={segmentedItemClass(n === goal.weekly_target, "h-6 w-7 justify-center px-0 text-xs tabular-nums")}
            >
              {n}
            </button>
          ))}
        </div>
        <span className="text-subtle text-[12px]">{goal.weekly_target === 7 ? "every day" : "days a week"}</span>
      </div>
      <div aria-hidden className={cn("flex gap-[3px]", boardTone(goal))}>
        {Array.from({ length: goal.weekly_target }, (_, i) => (
          <span key={i} className={cn("h-1 flex-1 rounded-[1px]", i < done ? "bg-current" : "bg-foreground/[0.07]")} />
        ))}
      </div>
    </div>
  );
}

function TaskList({ title, items, today }: { title: string; items: Item[]; today: string }) {
  return (
    <section>
      <GroupHeader count={items.length} className="px-3">
        {title}
      </GroupHeader>
      {items.map((i) => (
        <ItemRow key={i.id} item={i} today={today} showPlace density="minimal" />
      ))}
    </section>
  );
}

/** Why this goal matters. Saves as you pause typing, on blur and on
    leaving the page. While not being edited it shows the synced value, so
    an edit from another device appears (and isn't overwritten by a blur). */
function Notes({ goal }: { goal: Goal }) {
  const actions = useGoalActions();
  const [draft, setDraft] = React.useState<string | null>(null); // null = not editing
  const latest = React.useRef({ goal, draft });
  React.useEffect(() => {
    latest.current = { goal, draft };
    if (draft === null || draft === goal.notes) return;
    const t = setTimeout(() => void actions.edit(goal, { notes: draft }), 600);
    return () => clearTimeout(t);
  }, [draft, goal, actions]);
  // Unmount: flush the last keystrokes.
  React.useEffect(
    () => () => {
      const { goal, draft } = latest.current;
      if (draft !== null && draft !== goal.notes) void actions.edit(goal, { notes: draft });
    },
    [actions],
  );
  return (
    <textarea
      value={draft ?? goal.notes}
      maxLength={20000}
      rows={2}
      placeholder="Why this matters"
      aria-label="Goal notes"
      onFocus={() => setDraft(goal.notes)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null && draft !== goal.notes) void actions.edit(goal, { notes: draft });
        setDraft(null);
      }}
      className="placeholder:text-subtle field-sizing-content resize-none bg-transparent px-3 text-[14px] outline-none"
    />
  );
}

function GoalMenu({ goal, taskCount }: { goal: Goal; taskCount: number }) {
  const actions = useGoalActions();
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Goal options" render={<Button variant="ghost" size="icon-sm" />}>
          <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Colour</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-40">
              {(Object.keys(BOARD_TONES) as BoardToneKey[]).map((tone) => (
                <DropdownMenuItem key={tone} onClick={() => actions.edit(goal, { icon: tone })}>
                  <span aria-hidden className={cn("size-2 rounded-[1px] bg-current", BOARD_TONES[tone].cls)} />
                  {BOARD_TONES[tone].label}
                  {boardTone(goal) === BOARD_TONES[tone].cls ? <Check className="ml-auto size-3.5" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirming(true)}>
            Delete goal
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete “{goal.name}”?</DialogTitle>
            <DialogDescription>
              {taskCount ? `Its ${taskCount} task${taskCount === 1 ? "" : "s"} will stay, no longer linked to a goal. Its progress grid is lost.` : "The goal will be deleted."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirming(false);
                void actions.remove(goal);
                router.push("/goals");
              }}
            >
              Delete goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
