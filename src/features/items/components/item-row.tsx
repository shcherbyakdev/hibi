"use client";

import * as React from "react";
import { Check, NotebookText } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import type { Item } from "@/lib/sync/db";
import { cn } from "@/lib/utils";
import { usePrefs } from "@/lib/prefs";
import { isOverdue } from "@/features/planner/periods";
import { PlayButton, RowTime } from "@/features/time/components/row-timer";
import { useTimer } from "@/features/time/use-timer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useItemActions } from "../use-items";
import { placeLabel } from "../model";
import { PlanMenuItems } from "./plan-menu";
import { PRIORITY_LABELS, PriorityIcon, PriorityPicker } from "./priority-icon";
import { useItemSheet } from "./item-sheet";

/* A task, in one of two layouts:
   - "list" (Day, Inbox, board list): one 32px line —
       ○  ⌃  Title ……………………  notes · time · plan   [▶ ⋯]
   - "card" (week columns, kanban): the title wraps to two lines, metadata
     sits on a small line underneath, the way Jira/Linear cards read.
   - "minimal" (Today): the list line, roomier and quieter — 44px rows on
     hairline dividers, 14px titles, a lighter checkbox, flat hover.
   Hover actions (▶ timer, ⋯ menu) OVERLAY the row's right edge instead of
   reserving space, so a narrow column never loses its title to invisible
   buttons. The row is the focus stop (J/K, shortcuts); the title is text
   until clicked (so the row stays draggable), then an input. */
export function ItemRow({
  item,
  today,
  showPlace = false,
  overlay = false,
  density = "list",
}: {
  item: Item;
  today: string;
  /** Show where it's planned (Overdue group, boards). */
  showPlace?: boolean;
  overlay?: boolean;
  density?: "list" | "card" | "minimal";
}) {
  const actions = useItemActions();
  const timer = useTimer();
  const { weekStart } = usePrefs();
  const [editing, setEditing] = React.useState(false);
  const done = item.status === "done";
  const late = isOverdue(item, today, weekStart);
  const setPriority = (p: number) => void actions.edit(item, { priority: p });

  const checkbox = (
    <button
      type="button"
      data-no-dnd
      role="checkbox"
      aria-checked={done}
      aria-label={done ? `Mark "${item.title}" not done` : `Mark "${item.title}" done`}
      tabIndex={-1}
      onClick={() => actions.toggleDone(item)}
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 outline-none",
        density === "card" && "mt-0.5",
        done
          ? "border-primary bg-primary text-primary-foreground"
          : density === "minimal"
            ? "border-foreground/20 hover:border-foreground/45"
            : "border-foreground/25 hover:border-foreground/50",
      )}
    >
      {done ? <Check className="size-2.5" strokeWidth={3} /> : null}
    </button>
  );

  // One place for priority in every layout: right after the checkbox. With
  // none set, the slot stays reserved (titles never shift) and the picker
  // fades in there on hover. Done tasks keep their priority, quietly.
  const priority = overlay ? (
    item.priority ? <PriorityIcon priority={item.priority} className={cn(done && "opacity-40")} /> : <span className="size-4 shrink-0" />
  ) : (
    <PriorityPicker value={item.priority} onChange={setPriority} quietWhenNone className={cn("-mx-1", done && "opacity-40")} />
  );

  const title = editing ? (
    <TitleInput item={item} onDone={() => setEditing(false)} />
  ) : (
    <button
      type="button"
      tabIndex={-1}
      onClick={() => setEditing(true)}
      className={cn(
        "min-w-0 flex-1 text-left outline-none",
        density === "card" ? "line-clamp-2 leading-5 break-words" : "truncate",
        done && "text-muted-foreground line-through",
      )}
    >
      {item.title}
    </button>
  );

  const meta = (
    <>
      {item.notes ? <NotebookText aria-label="Has notes" className="text-subtle size-3.5 shrink-0" /> : null}
      {overlay ? null : <RowTime item={item} />}
      {showPlace && item.plan_scope ? (
        <span className={cn("shrink-0 truncate font-mono text-[11px] uppercase tracking-[0.06em]", late ? "text-destructive" : "text-subtle")}>{placeLabel(item)}</span>
      ) : null}
    </>
  );

  const rowProps = {
    // The drag overlay is a copy: never a second focus stop or shortcut target.
    ...(overlay ? {} : { tabIndex: 0, "data-item-id": item.id, "aria-label": item.title }),
    className: cn(
      "group/row relative rounded-lg px-2 text-[13px] transition-colors duration-150 outline-none",
      overlay
        ? "bg-card shadow-(--shadow-lift) ring-1 ring-foreground/10"
        : // Solid on hover/focus: the overlaid actions fade into this exact colour.
          "hover:bg-muted focus-visible:bg-muted has-data-popup-open:bg-muted focus-visible:ring-1 focus-visible:ring-ring/50",
    ),
  };

  if (density === "card") {
    const tracked = timer.running?.item_id === item.id || timer.totalFor(item.id) > 0;
    const hasMeta = !!item.notes || tracked || (showPlace && !!item.plan_scope);
    return (
      <div {...rowProps} className={cn(rowProps.className, "flex flex-col gap-1 py-1.5")}>
        <div className="flex items-start gap-2 pr-1">
          {checkbox}
          {/* Centred on the title's first line (20px). */}
          <span className="flex h-5 shrink-0 items-center">{priority}</span>
          {title}
        </div>
        {hasMeta ? (
          // Under the title: checkbox 16 + gap 8 + priority 16 + gap 8 = 48px.
          <div className="flex min-w-0 items-center gap-2 pl-12">{meta}</div>
        ) : null}
        {overlay ? null : <HoverActions item={item} today={today} className="top-1 right-1 h-6" />}
      </div>
    );
  }

  return (
    <div
      {...rowProps}
      className={cn(rowProps.className, "flex items-center", density === "minimal" ? "h-11 gap-3 rounded-none border-b px-3 text-[14px]" : "h-8 gap-2")}
    >
      {checkbox}
      {priority}
      {title}
      {/* On hover/focus the actions take this spot: metadata fades out whole
          rather than showing half-covered fragments. */}
      <span className="flex shrink-0 items-center gap-2 transition-opacity duration-150 group-focus-within/row:opacity-0 group-hover/row:opacity-0 group-has-data-popup-open/row:opacity-0">
        {meta}
      </span>
      {overlay ? null : <HoverActions item={item} today={today} className={cn("inset-y-0", density === "minimal" ? "right-2" : "right-1")} />}
    </div>
  );
}

/** ▶ and ⋯ laid over the row's right edge on hover/focus, on a fade of the
    row's hover colour; click-through while hidden. */
function HoverActions({ item, today, className }: { item: Item; today: string; className?: string }) {
  const actions = useItemActions();
  const sheet = useItemSheet();
  const button = "text-subtle hover:text-foreground hover:bg-background/60 flex size-6 shrink-0 items-center justify-center rounded-md outline-none";
  return (
    <div
      className={cn(
        "pointer-events-none absolute flex items-center gap-0.5 bg-[linear-gradient(to_left,var(--muted)_calc(100%_-_2rem),transparent)] pl-8 opacity-0 transition-opacity duration-150",
        "group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100 has-data-popup-open:pointer-events-auto has-data-popup-open:opacity-100",
        className,
      )}
    >
      <PlayButton item={item} className={button} />
      <DropdownMenu>
        <DropdownMenuTrigger data-no-dnd aria-label={`Options for "${item.title}"`} className={cn(button, "focus-visible:ring-ring/40 focus-visible:ring-2")}>
          <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => sheet.open(item.id)}>Open details</DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Priority</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-44">
              {[1, 2, 3, 4, 0].map((p) => (
                <DropdownMenuItem key={p} disabled={item.priority === p} onClick={() => actions.edit(item, { priority: p })}>
                  <PriorityIcon priority={p} />
                  {PRIORITY_LABELS[p]}
                  <span className="text-subtle ml-auto font-mono text-[11px]">{p}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <PlanMenuItems item={item} today={today} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function TitleInput({ item, onDone }: { item: Item; onDone: () => void }) {
  const actions = useItemActions();
  const [value, setValue] = React.useState(item.title);
  const save = () => {
    void actions.rename(item, value);
    onDone();
  };
  return (
    <input
      autoFocus
      value={value}
      maxLength={500}
      aria-label="Title"
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") save();
        if (e.key === "Escape") onDone();
      }}
      className="min-w-0 flex-1 bg-transparent outline-none"
    />
  );
}

/** A task as a bordered card (week columns, kanban): the border says where
    one task ends and the next begins, so its metadata line clearly belongs
    to it; cards sit 6px apart. Done cards step back. The drag copy draws
    its own lifted card (ItemRow overlay). */
export function ItemCard({ item, today, showPlace = false, overlay = false }: { item: Item; today: string; showPlace?: boolean; overlay?: boolean }) {
  return (
    <div className="py-[3px]">
      {overlay ? (
        <ItemRow item={item} today={today} showPlace={showPlace} density="card" overlay />
      ) : (
        <div className={cn("bg-card rounded-md border transition-opacity", item.status === "done" && "opacity-60 hover:opacity-100")}>
          <ItemRow item={item} today={today} showPlace={showPlace} density="card" />
        </div>
      )}
    </div>
  );
}
