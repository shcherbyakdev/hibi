"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** Index = priority value: 0 none, 1 urgent … 4 low (Linear's order). */
export const PRIORITY_LABELS = ["No priority", "Urgent", "High", "Medium", "Low"] as const;

/* Jira-style glyphs: urgent ⇈ red, high ^ rose, medium = amber, low ∨
   teal. "No priority" is a faint = so the slot still reads as a control. */
const GLYPHS = [
  { d: "M3.5 6.5h9M3.5 9.5h9", tone: "text-subtle opacity-40" },
  { d: "M4 8.5l4-4 4 4M4 12.5l4-4 4 4", tone: "text-destructive" },
  { d: "M4 10l4-4 4 4", tone: "text-tone-rose" },
  { d: "M3.5 6.5h9M3.5 9.5h9", tone: "text-tone-amber" },
  { d: "M4 6l4 4 4-4", tone: "text-tone-teal" },
];

export function PriorityIcon({ priority, className }: { priority: number; className?: string }) {
  const g = GLYPHS[priority] ?? GLYPHS[0];
  return (
    <svg
      viewBox="0 0 16 16"
      role="img"
      aria-label={priority ? `${PRIORITY_LABELS[priority]} priority` : "No priority"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4 shrink-0", g.tone, className)}
    >
      <path d={g.d} />
    </svg>
  );
}

/** Click the icon, pick a level. On rows it sits right after the checkbox;
    with no priority it's faint until the row is hovered or focused, so
    every row offers it without adding noise. */
export function PriorityPicker({
  value,
  onChange,
  quietWhenNone = false,
  className,
  iconClassName,
}: {
  value: number;
  onChange: (priority: number) => void;
  /** Fade the "none" icon until the parent row (group/row) is hovered or focused. */
  quietWhenNone?: boolean;
  className?: string;
  /** Size the glyph (e.g. "size-3" in month-calendar chips). */
  iconClassName?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-no-dnd
        tabIndex={-1}
        aria-label={`Priority: ${PRIORITY_LABELS[value]}. Change priority`}
        title="Priority"
        className={cn(
          "hover:bg-muted focus-visible:ring-ring/40 flex size-6 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2",
          quietWhenNone && !value && "opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 data-popup-open:opacity-100",
          className,
        )}
      >
        <PriorityIcon priority={value} className={iconClassName} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {/* Urgent first, "No priority" last: the order you scan for. */}
        {[1, 2, 3, 4, 0].map((p) => (
          <DropdownMenuItem key={p} onClick={() => onChange(p)}>
            <PriorityIcon priority={p} />
            {PRIORITY_LABELS[p]}
            {value === p ? <Check className="ml-auto size-3.5" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
