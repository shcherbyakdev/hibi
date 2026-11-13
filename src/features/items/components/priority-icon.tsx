"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** Index = priority value: 0 none, 1 urgent … 4 low (Linear's order). */
export const PRIORITY_LABELS = ["No priority", "Urgent", "High", "Medium", "Low"] as const;

/* Signal bars (Linear-style): three ascending bars, the lit count is the
   level — high 3, medium 2, low 1 — lit in orange; urgent lights all three
   in red. Unlit bars are faint grey; "No priority" is all three faint. */
const LIT = [0, 3, 3, 2, 1];
const BARS = [
  { x: 2, h: 5 },
  { x: 6.5, h: 8 },
  { x: 11, h: 11 },
];

export function PriorityIcon({ priority, className }: { priority: number; className?: string }) {
  const lit = LIT[priority] ?? 0;
  return (
    <svg
      viewBox="0 0 16 16"
      role="img"
      aria-label={priority ? `${PRIORITY_LABELS[priority]} priority` : "No priority"}
      className={cn("size-4 shrink-0", priority === 1 ? "text-priority-urgent" : "text-priority", className)}
    >
      {BARS.map((b, i) => (
        <rect key={i} x={b.x} y={13.5 - b.h} width="3" height={b.h} rx="1" fill={i < lit ? "currentColor" : "var(--subtle)"} opacity={i < lit ? 1 : 0.3} />
      ))}
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
}: {
  value: number;
  onChange: (priority: number) => void;
  /** Fade the "none" icon until the parent row (group/row) is hovered or focused. */
  quietWhenNone?: boolean;
  className?: string;
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
        <PriorityIcon priority={value} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {/* Urgent first, "No priority" last: the order you scan for. */}
        {[1, 2, 3, 4, 0].map((p) => (
          <DropdownMenuItem key={p} onClick={() => onChange(p)}>
            <PriorityIcon priority={p} />
            {PRIORITY_LABELS[p]}
            {value === p ? <Check className="ml-auto size-3.5" /> : <span className="text-subtle ml-auto font-mono text-[11px]">{p}</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
