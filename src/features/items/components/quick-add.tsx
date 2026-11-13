"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useItemActions } from "../use-items";
import type { Place, Spot } from "../model";
import { cn } from "@/lib/utils";

/** Type and Enter; focus stays for the next one. The input is the empty state. */
export function QuickAdd({ place, spot, placeholder = "Add task", className }: { place: Place; spot?: Spot; placeholder?: string; className?: string }) {
  const actions = useItemActions();
  const [value, setValue] = React.useState("");
  return (
    <label className={cn("text-subtle focus-within:text-foreground flex h-8 items-center gap-2.5 rounded-lg px-2 text-[13px]", className)}>
      <Plus className="size-4 shrink-0" />
      <input
        value={value}
        maxLength={500}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) {
            void actions.create(value, place, spot);
            setValue("");
          }
          if (e.key === "Escape") e.currentTarget.blur();
        }}
        className="placeholder:text-subtle text-foreground min-w-0 flex-1 bg-transparent outline-none"
      />
    </label>
  );
}
