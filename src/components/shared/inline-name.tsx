"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Text until clicked, then an input: Enter/blur saves, Escape reverts.
    Used for board and column names. */
export function InlineName({ value, onSave, maxLength, label, className }: { value: string; onSave: (v: string) => void; maxLength: number; label: string; className?: string }) {
  const [draft, setDraft] = React.useState<string | null>(null);
  if (draft === null)
    return (
      <button type="button" data-no-dnd onClick={() => setDraft(value)} className={cn("min-w-0 truncate rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40", className)}>
        {value}
        {/* The name stays the accessible text (headings read it); the hint follows. */}
        <span className="sr-only"> (rename {label})</span>
      </button>
    );
  const save = () => {
    onSave(draft);
    setDraft(null);
  };
  return (
    <input
      autoFocus
      value={draft}
      maxLength={maxLength}
      aria-label={`${label} name`}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") save();
        if (e.key === "Escape") setDraft(null);
      }}
      // Typing shows exactly what will be stored, even inside an uppercase label.
      className={cn("min-w-0 flex-1 bg-transparent outline-none", className, "normal-case")}
    />
  );
}

/** "+ Add column" that turns into a name field. */
export function AddNamed({ label, onAdd, maxLength = 80, className }: { label: string; onAdd: (name: string) => void; maxLength?: number; className?: string }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const submit = () => {
    if (name.trim()) onAdd(name);
    setName("");
  };
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className={cn("text-subtle hover:text-foreground flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40", className)}>
        <span aria-hidden>+</span> {label}
      </button>
    );
  return (
    <input
      autoFocus
      value={name}
      maxLength={maxLength}
      placeholder="Name"
      aria-label={label}
      onChange={(e) => setName(e.target.value)}
      onBlur={() => {
        submit();
        setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") submit(); // stays open for the next one
        if (e.key === "Escape") {
          setName("");
          setOpen(false);
        }
      }}
      className={cn("bg-card placeholder:text-subtle h-8 rounded-lg border px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40", className)}
    />
  );
}
