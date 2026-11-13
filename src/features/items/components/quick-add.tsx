"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useItemActions } from "../use-items";
import type { Place, Spot } from "../model";
import { cn } from "@/lib/utils";
import { PriorityPicker } from "./priority-icon";

/** Type and Enter; focus stays for the next one. The input is the empty
    state. Once you start typing, a priority button appears beside it (it
    resets after each task); "!1"–"!4" in the text works too. */
export function QuickAdd({ place, spot, placeholder = "Add task", className }: { place: Place; spot?: Spot; placeholder?: string; className?: string }) {
  const actions = useItemActions();
  const [value, setValue] = React.useState("");
  const [priority, setPriority] = React.useState(0);
  const input = React.useRef<HTMLInputElement>(null);
  const active = value.length > 0 || priority > 0;

  return (
    <div className={cn("text-subtle focus-within:text-foreground group/qa flex h-8 items-center gap-2.5 rounded-lg px-2 text-[13px]", className)}>
      <Plus className="size-4 shrink-0" />
      <input
        ref={input}
        value={value}
        maxLength={500}
        placeholder={placeholder}
        aria-label={placeholder}
        data-quick-add
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) {
            void actions.create(value, place, spot, priority);
            setValue("");
            setPriority(0);
          }
          if (e.key === "Escape") e.currentTarget.blur();
        }}
        className="placeholder:text-subtle text-foreground min-w-0 flex-1 bg-transparent outline-none"
      />
      {active ? (
        <PriorityPicker
          value={priority}
          onChange={(p) => {
            setPriority(p);
            input.current?.focus();
          }}
          className="text-subtle"
        />
      ) : null}
    </div>
  );
}
