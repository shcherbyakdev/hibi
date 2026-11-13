"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import type { Item } from "@/lib/sync/db";
import { cn } from "@/lib/utils";
import { isOverdue } from "@/features/planner/periods";
import { useItemActions } from "../use-items";
import { placeLabel } from "../model";
import { PlanMenuItems } from "./plan-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/* Linear-density row: 13px, 32px tall, flat on the ground, hover tint. The
   title is text until clicked (so the row can be dragged), then an input:
   Enter or blur saves, Escape reverts. */
export function ItemRow({
  item,
  today,
  showPlace = false,
  overlay = false,
}: {
  item: Item;
  today: string;
  /** Show where it's planned (Overdue group, Inbox has none). */
  showPlace?: boolean;
  overlay?: boolean;
}) {
  const actions = useItemActions();
  const [editing, setEditing] = React.useState(false);
  const done = item.status === "done";
  const late = isOverdue(item, today);

  return (
    <div
      className={cn(
        "group/row flex h-8 items-center gap-2.5 rounded-lg px-2 text-[13px] transition-colors duration-150",
        overlay ? "bg-card shadow-(--shadow-lift) ring-1 ring-foreground/10" : "hover:bg-muted/60",
      )}
    >
      <button
        type="button"
        data-no-dnd
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Mark "${item.title}" not done` : `Mark "${item.title}" done`}
        onClick={() => actions.toggleDone(item)}
        className={cn(
          "focus-visible:ring-ring/40 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 outline-none focus-visible:ring-2",
          done ? "border-brand bg-brand text-white" : "border-foreground/25 hover:border-foreground/50",
        )}
      >
        {done ? <Check className="size-2.5" strokeWidth={3} /> : null}
      </button>

      {editing ? (
        <TitleInput item={item} onDone={() => setEditing(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={cn("min-w-0 flex-1 truncate text-left outline-none", done && "text-muted-foreground line-through")}
        >
          {item.title}
        </button>
      )}

      {showPlace && item.plan_scope ? (
        <span className={cn("shrink-0 text-xs", late ? "text-danger" : "text-subtle")}>{placeLabel(item)}</span>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger
          data-no-dnd
          aria-label={`Options for "${item.title}"`}
          className="text-subtle hover:text-foreground focus-visible:ring-ring/40 flex size-6 shrink-0 items-center justify-center rounded-md opacity-0 outline-none group-focus-within/row:opacity-100 group-hover/row:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 data-popup-open:opacity-100"
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
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
