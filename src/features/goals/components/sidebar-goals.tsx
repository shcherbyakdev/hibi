"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { activeClass, idleClass, itemClass, sectionLabelClass } from "@/components/shell/sidebar-styles";
import { cn } from "@/lib/utils";
import { useGoalActions, useGoals } from "../use-goals";
import { toneClass } from "@/lib/tone";

/** The sidebar's Goals section: one row per goal, and + to name a new one
    inline (Enter creates it and opens it, Escape cancels). */
export function SidebarGoals({ onNavigate }: { onNavigate?: () => void }) {
  const goals = useGoals();
  const actions = useGoalActions();
  const pathname = usePathname();
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState("");

  const create = async () => {
    const id = await actions.create(name);
    setAdding(false);
    setName("");
    if (id) {
      router.push(`/goals/${id}`);
      onNavigate?.();
    }
  };

  return (
    <div className="flex min-h-0 flex-col gap-0.5">
      <div className={cn(sectionLabelClass, "group/goals justify-between pr-0.5")}>
        <Link href="/goals" onClick={onNavigate} aria-current={pathname === "/goals" ? "page" : undefined} className={cn("hover:text-foreground outline-none focus-visible:underline", pathname === "/goals" && "text-foreground")}>
          Goals
        </Link>
        <button
          type="button"
          aria-label="New goal"
          onClick={() => setAdding(true)}
          title="New goal"
          className="text-subtle hover:text-foreground hover:bg-foreground/[0.06] focus-visible:ring-ring/60 flex size-5 items-center justify-center rounded-md opacity-60 outline-none group-hover/goals:opacity-100 focus-visible:opacity-100 focus-visible:ring-1"
        >
          <HugeiconsIcon icon={PlusSignIcon} size={13} />
        </button>
      </div>
      <div className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
        {goals?.map((g) => {
          const href = `/goals/${g.id}`;
          const active = pathname === href;
          return (
            <Link key={g.id} href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn(itemClass, active ? activeClass : idleClass)}>
              <span aria-hidden className={cn("mx-[3px] size-2 shrink-0 rounded-[1px] bg-current", toneClass(g))} />
              <span className="truncate">{g.name}</span>
            </Link>
          );
        })}
        {adding ? (
          // Reads as the row it is about to become: same height, icon, padding.
          <label className={cn(itemClass, "bg-foreground/[0.05] ring-brand/50 ring-1 ring-inset")}>
            <span aria-hidden className="bg-subtle mx-[3px] size-2 shrink-0 rounded-[1px]" />
            <input
            autoFocus
            value={name}
            maxLength={120}
            placeholder="Goal name"
            aria-label="New goal name"
            onChange={(e) => setName(e.target.value)}
            onBlur={() => (name.trim() ? void create() : setAdding(false))}
            onKeyDown={(e) => {
              if (e.key === "Enter") void create();
              if (e.key === "Escape") {
                setName("");
                setAdding(false);
              }
            }}
              className="placeholder:text-subtle text-foreground min-w-0 flex-1 bg-transparent font-medium outline-none"
            />
          </label>
        ) : goals && !goals.length ? (
          <button type="button" onClick={() => setAdding(true)} className={cn(itemClass, idleClass, "text-subtle")}>
            Create a goal
          </button>
        ) : null}
      </div>
    </div>
  );
}
