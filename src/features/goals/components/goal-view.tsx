"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { Check, X } from "lucide-react";
import type { Goal, Item } from "@/lib/sync/db";
import { useToday } from "@/lib/use-today";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { PageActions } from "@/components/shell/page-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TONES, toneClass, type ToneKey } from "@/lib/tone";
import { AddNamed, InlineName } from "@/components/shared/inline-name";
import { DayPicker } from "@/features/routines/components/day-picker";
import { useGoalRoutines, useRoutineActions } from "@/features/routines/use-routines";
import { GroupHeader } from "@/features/planner/components/planner-board";
import { ItemRow } from "@/features/items/components/item-row";
import { QuickAdd } from "@/features/items/components/quick-add";
import { dayCounts, openSteps, weekCount } from "../model";
import { usePrefs } from "@/lib/prefs";
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
  const open = openSteps(items, today);
  const done = items.filter((i) => i.done_at).sort((a, b) => (a.done_at! < b.done_at! ? 1 : -1)).slice(0, RECENT);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <PageActions>
        <GoalMenu goal={goal} taskCount={items.length} />
      </PageActions>
      <div className="flex flex-col gap-1 px-3">
        <h2 className="flex items-center gap-2 text-[22px] font-normal tracking-[-0.03em]">
          <span aria-hidden className={cn("size-2.5 shrink-0 rounded-[1px] bg-current", toneClass(goal))} />
          <InlineName value={goal.name} label="goal" maxLength={120} onSave={(n) => actions.edit(goal, { name: n })} />
        </h2>
        <GoalStats goal={goal} counts={counts} today={today} />
      </div>

      <WeeklyAim goal={goal} done={weekCount(counts, today, weekStart)} />

      <div className="px-3">
        <ContributionGrid counts={counts} today={today} weeks={53} tone={toneClass(goal)} />
      </div>

      <Notes key={goal.id} goal={goal} />

      <QuickAdd place={{ plan_scope: "day", plan_date: today }} goalId={goal.id} placeholder="Add a step for today" className="h-11 gap-3 px-3 text-[14px]" />

      <Routines goalId={goal.id} />
      <TaskList title="Open" items={open} today={today} />
      {done.length ? <TaskList title="Done recently" items={done} today={today} /> : null}
    </div>
  );
}

const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const daysLabel = (n: number) => (n === 7 ? "Every day" : `${n} ${n === 1 ? "day" : "days"} a week`);

/** The weekly aim as seven day squares: click one to aim for that many
    days. Aimed days are tinted in the goal's colour and fill solid as this
    week's days get done, so the control is also the week's progress.
    Native radios underneath: arrow keys and screen readers work as usual. */
function WeeklyAim({ goal, done }: { goal: Goal; done: number }) {
  const actions = useGoalActions();
  const [hover, setHover] = React.useState<number | null>(null);
  const shown = hover ?? goal.weekly_target;
  return (
    <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3" onMouseLeave={() => setHover(null)}>
      <legend className="sr-only">Weekly aim</legend>
      <span aria-hidden className="text-subtle w-full font-mono text-[11px] tracking-[0.06em] uppercase">
        Weekly aim
      </span>
      <div className={cn("flex gap-1", toneClass(goal))}>
        {DAYS.map((n) => (
          <label key={n} className="cursor-pointer" onMouseEnter={() => setHover(n)}>
            <input
              type="radio"
              name={`aim-${goal.id}`}
              value={n}
              checked={n === goal.weekly_target}
              onChange={() => actions.edit(goal, { weekly_target: n })}
              aria-label={daysLabel(n)}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className={cn(
                "peer-focus-visible:ring-ring/60 block size-6 rounded-[2px] transition-colors duration-100 peer-focus-visible:ring-2",
                n <= done ? "bg-current" : n <= shown ? "bg-current/25" : "bg-foreground/[0.07] hover:bg-foreground/[0.12]",
              )}
            />
          </label>
        ))}
      </div>
      <span className={cn("text-[13px] tabular-nums", hover === null ? "text-muted-foreground" : "text-foreground")}>{daysLabel(shown)}</span>
    </fieldset>
  );
}

/** Steps that come back on their own; each due day's copy lands in Today. */
function Routines({ goalId }: { goalId: string }) {
  const routines = useGoalRoutines(goalId);
  const actions = useRoutineActions();
  if (!routines) return null;
  return (
    <section>
      <GroupHeader count={routines.length} className="px-3">
        Routines
      </GroupHeader>
      {routines.map((r) => (
        <div key={r.id} className="group/routine flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-1.5 text-[14px]">
          <InlineName value={r.title} label="routine" maxLength={500} onSave={(t) => actions.rename(r, t)} className="min-w-0 flex-1" />
          <DayPicker days={r.days} onChange={(d) => actions.setDays(r, d)} label={`Days for ${r.title}`} />
          <Button variant="ghost" size="icon-sm" aria-label={`Delete routine ${r.title}`} onClick={() => actions.remove(r)} className="text-subtle">
            <X />
          </Button>
        </div>
      ))}
      <AddNamed label="Add a routine" maxLength={500} className="px-3" onAdd={(title) => void actions.create({ title, goal_id: goalId })} />
    </section>
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
              {(Object.keys(TONES) as ToneKey[]).map((tone) => (
                <DropdownMenuItem key={tone} onClick={() => actions.edit(goal, { icon: tone })}>
                  <span aria-hidden className={cn("size-2 rounded-[1px] bg-current", TONES[tone].cls)} />
                  {TONES[tone].label}
                  {toneClass(goal) === TONES[tone].cls ? <Check className="ml-auto size-3.5" /> : null}
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
              {taskCount ? `Its ${taskCount} task${taskCount === 1 ? "" : "s"} will stay, no longer linked to a goal. Its routines stop and its progress grid is lost.` : "The goal and its routines will be deleted."}
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
