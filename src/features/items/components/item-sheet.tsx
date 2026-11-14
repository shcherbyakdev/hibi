"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Trash2 } from "lucide-react";
import { ITEM_STATUSES, PLAN_SCOPES, type PlanScope } from "@/db/enums";
import type { Item } from "@/lib/sync/db";
import { useSync } from "@/lib/sync/provider";
import { usePrefs } from "@/lib/prefs";
import { useToday } from "@/lib/use-today";
import { Button } from "@/components/ui/button";
import { DialogSelect } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SEGMENTED_NAV_CLASS, segmentedItemClass } from "@/components/ui/segmented";
import { periodOf } from "@/features/planner/periods";
import { useBoards, useColumns } from "@/features/boards/use-boards";
import { useGoals } from "@/features/goals/use-goals";
import { DayPicker } from "@/features/routines/components/day-picker";
import { useRoutine, useRoutineActions } from "@/features/routines/use-routines";
import { useItemActions } from "../use-items";
import { bySortKey, INBOX, isLive } from "../model";
import { PRIORITY_LABELS } from "./priority-icon";
import { TimeSection } from "@/features/time/components/time-section";

type Ctx = { open: (id: string) => void };
const ItemSheetContext = React.createContext<Ctx>({ open: () => {} });
export const useItemSheet = () => React.use(ItemSheetContext);

/** One details panel for the whole app; any row, shortcut or ⌘K opens it. */
export function ItemSheetProvider({ children }: { children: React.ReactNode }) {
  const [id, setId] = React.useState<string | null>(null);
  const ctx = React.useMemo(() => ({ open: setId }), []);
  return (
    <ItemSheetContext value={ctx}>
      {children}
      <Sheet open={id !== null} onOpenChange={(o) => !o && setId(null)}>
        <SheetContent side="right" className="w-full gap-0 p-0 data-[side=right]:sm:max-w-lg">
          {id ? <ItemDetail id={id} onClose={() => setId(null)} /> : null}
        </SheetContent>
      </Sheet>
    </ItemSheetContext>
  );
}

const STATUS_LABELS: Record<Item["status"], string> = { todo: "To do", doing: "Doing", done: "Done", dropped: "Dropped" };
const fieldLabel = "text-subtle w-16 shrink-0 pt-2 font-mono text-[11px] uppercase tracking-[0.06em]";

function ItemDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { db } = useSync();
  const item = useLiveQuery(async () => (await db.items.get(id)) ?? null, [db, id]);
  const today = useToday();
  if (item === undefined || !today) return null;
  if (item === null || !isLive(item))
    return (
      <div className="p-6">
        <SheetTitle>Task not found</SheetTitle>
      </div>
    );
  // Keyed by id: switching tasks resets the drafts.
  return <DetailForm key={item.id} item={item} today={today} onClose={onClose} />;
}

function DetailForm({ item, today, onClose }: { item: Item; today: string; onClose: () => void }) {
  const actions = useItemActions();
  const { weekStart } = usePrefs();
  const [title, setTitle] = React.useState(item.title);
  const [notes, setNotes] = React.useState(item.notes);

  // Notes save as you pause typing, and on close.
  const notesRef = React.useRef(notes);
  React.useEffect(() => {
    notesRef.current = notes;
    if (notes === item.notes) return;
    const t = setTimeout(() => void actions.edit(item, { notes }), 600);
    return () => clearTimeout(t);
  }, [notes, item, actions]);
  React.useEffect(
    () => () => {
      if (notesRef.current !== item.notes) void actions.edit(item, { notes: notesRef.current });
    },
    // Unmount only: flush the last keystrokes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const setPlan = (scope: PlanScope | "", date: string) =>
    actions.plan(item, scope ? { plan_scope: scope, plan_date: periodOf(scope, date || today, weekStart) } : INBOX);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-5 py-4">
        <SheetTitle className="sr-only">Task details</SheetTitle>
        <textarea
          value={title}
          rows={1}
          maxLength={500}
          aria-label="Title"
          onChange={(e) => setTitle(e.target.value.replace(/\n/g, ""))}
          onBlur={() => void actions.rename(item, title)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), e.currentTarget.blur())}
          className="field-sizing-content w-full resize-none bg-transparent pr-8 text-lg font-semibold tracking-[-0.01em] outline-none"
        />
      </div>

      <div className="flex flex-col gap-3 px-5 py-4 text-[13px]">
        <Field label="Status">
          <Segmented value={item.status} options={ITEM_STATUSES.map((s) => [s, STATUS_LABELS[s]])} onChange={(s) => actions.setStatus(item, s)} label="Status" />
        </Field>
        <Field label="Priority">
          <Segmented value={String(item.priority)} options={PRIORITY_LABELS.map((l, i) => [String(i), i ? l : "None"])} onChange={(p) => actions.edit(item, { priority: Number(p) })} label="Priority" />
        </Field>
        <Field label="Plan">
          <div className="flex flex-1 gap-2">
            <DialogSelect aria-label="Plan for" value={item.plan_scope ?? ""} onChange={(e) => setPlan(e.target.value as PlanScope | "", item.plan_date ?? today)} className="h-8 w-28 text-[13px]">
              <option value="">Unplanned</option>
              {PLAN_SCOPES.map((s) => (
                <option key={s} value={s}>
                  {s === "day" ? "Day" : s === "week" ? "Week of" : "Month of"}
                </option>
              ))}
            </DialogSelect>
            {item.plan_scope ? (
              <input
                type="date"
                aria-label="Plan date"
                value={item.plan_date ?? ""}
                onChange={(e) => e.target.value && setPlan(item.plan_scope!, e.target.value)}
                className="bg-card h-8 flex-1 rounded-lg border px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            ) : null}
          </div>
        </Field>
        <BoardField item={item} />
        <GoalField item={item} />
        <RepeatField item={item} />
      </div>

      <TimeSection item={item} />

      <div className="flex min-h-0 flex-1 flex-col border-t px-5 py-4">
        <textarea
          value={notes}
          maxLength={20000}
          placeholder="Notes"
          aria-label="Notes"
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== item.notes && void actions.edit(item, { notes })}
          className="placeholder:text-subtle min-h-40 flex-1 resize-none bg-transparent text-[13px] leading-relaxed outline-none"
        />
      </div>

      <div className="text-subtle flex items-center gap-3 border-t px-5 py-3 text-xs">
        <span>Created {new Date(item.created_at).toLocaleDateString()}</span>
        {item.done_at ? <span>Done {new Date(item.done_at).toLocaleDateString()}</span> : null}
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive ml-auto"
          onClick={() => {
            onClose();
            void actions.remove(item);
          }}
        >
          <Trash2 /> Delete
        </Button>
      </div>
    </div>
  );
}

function BoardField({ item }: { item: Item }) {
  const { db } = useSync();
  const actions = useItemActions();
  const boards = useBoards();
  const columns = useColumns(item.board_id ?? "");
  if (!boards) return null;
  return (
    <Field label="Board">
      <div className="flex flex-1 gap-2">
        <DialogSelect
          aria-label="Board"
          value={item.board_id ?? ""}
          onChange={(e) => {
            const boardId = e.target.value;
            // A new board starts in its first column (looked up on write).
            void (boardId ? firstColumn(boardId).then((col) => actions.moveToBoard(item, { board_id: boardId, column_id: col })) : actions.moveToBoard(item, null));
          }}
          className="h-8 w-40 text-[13px]"
        >
          <option value="">None</option>
          {boards.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </DialogSelect>
        {item.board_id && columns ? (
          <DialogSelect aria-label="Column" value={item.column_id ?? ""} onChange={(e) => actions.moveToBoard(item, { board_id: item.board_id!, column_id: e.target.value || null })} className="h-8 flex-1 text-[13px]">
            <option value="">No column</option>
            {columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </DialogSelect>
        ) : null}
      </div>
    </Field>
  );

  async function firstColumn(boardId: string): Promise<string | null> {
    const cols = (await db.board_columns.where("board_id").equals(boardId).filter(isLive).toArray()).sort(bySortKey);
    return cols[0]?.id ?? null;
  }
}

/** Never, or the weekdays its routine repeats on. On a plain task,
    "Repeats" turns it into a routine (it becomes today's copy). */
function RepeatField({ item }: { item: Item }) {
  const routine = useRoutine(item.routine_id);
  const actions = useRoutineActions();
  if (routine === undefined) return null;
  return (
    <Field label="Repeat">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <DialogSelect
          aria-label="Repeat"
          value={routine ? "repeats" : ""}
          onChange={(e) => void (e.target.value ? actions.fromTask(item) : routine && actions.remove(routine))}
          className="h-8 w-28 text-[13px]"
        >
          <option value="">Never</option>
          <option value="repeats">Repeats</option>
        </DialogSelect>
        {routine ? <DayPicker days={routine.days} onChange={(d) => actions.setDays(routine, d)} label="Repeat on" /> : null}
      </div>
    </Field>
  );
}

function GoalField({ item }: { item: Item }) {
  const actions = useItemActions();
  const goals = useGoals();
  if (!goals) return null;
  return (
    <Field label="Goal">
      <DialogSelect aria-label="Goal" value={item.goal_id ?? ""} onChange={(e) => actions.setGoal(item, e.target.value || null)} className="h-8 w-40 text-[13px]">
        <option value="">None</option>
        {/* Linked to a goal deleted elsewhere: show it, so "None" can unlink. */}
        {item.goal_id && !goals.some((g) => g.id === item.goal_id) ? <option value={item.goal_id}>Deleted goal</option> : null}
        {goals.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </DialogSelect>
    </Field>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className={fieldLabel}>{label}</span>
      {children}
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={SEGMENTED_NAV_CLASS}>
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={v === value} onClick={() => onChange(v)} className={segmentedItemClass(v === value, "h-6 px-2 text-xs")}>
          {l}
        </button>
      ))}
    </div>
  );
}
