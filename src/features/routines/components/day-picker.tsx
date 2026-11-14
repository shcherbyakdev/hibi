"use client";

import { cn } from "@/lib/utils";
import { usePrefs } from "@/lib/prefs";
import { DAY_LETTERS, DAY_NAMES, dayOrder, toggleDay } from "../model";

/** Seven weekday toggles in the week-start order, the same squares as the
    weekly aim. The last day can't be switched off. */
export function DayPicker({ days, onChange, label }: { days: number; onChange: (days: number) => void; label: string }) {
  const { weekStart } = usePrefs();
  return (
    <div role="group" aria-label={label} className="flex gap-1">
      {dayOrder(weekStart).map((d) => {
        const on = (days & (1 << d)) !== 0;
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            aria-label={DAY_NAMES[d]}
            onClick={() => onChange(toggleDay(days, d))}
            className={cn(
              "focus-visible:ring-ring/60 size-6 shrink-0 rounded-[2px] font-mono text-[10px] transition-colors duration-100 outline-none focus-visible:ring-2",
              on ? "bg-foreground text-background" : "bg-foreground/[0.07] text-subtle hover:bg-foreground/[0.12]",
            )}
          >
            {DAY_LETTERS[d]}
          </button>
        );
      })}
    </div>
  );
}
