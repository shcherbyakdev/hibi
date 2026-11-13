"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { DashboardSquare02Icon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { activeClass, idleClass, itemClass, sectionLabelClass } from "@/components/shell/sidebar-styles";
import { cn } from "@/lib/utils";
import { useBoardActions, useBoards } from "../use-boards";

/** The sidebar's Boards section: one row per board, and + to name a new one
    inline (Enter creates it and opens it, Escape cancels). */
export function SidebarBoards({ onNavigate }: { onNavigate?: () => void }) {
  const boards = useBoards();
  const actions = useBoardActions();
  const pathname = usePathname();
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState("");

  const create = async () => {
    const id = await actions.createBoard(name);
    setAdding(false);
    setName("");
    if (id) {
      router.push(`/boards/${id}`);
      onNavigate?.();
    }
  };

  return (
    <div className="flex min-h-0 flex-col gap-0.5">
      <div className={cn(sectionLabelClass, "group/boards justify-between pr-1")}>
        Boards
        <button
          type="button"
          aria-label="New board"
          onClick={() => setAdding(true)}
          className="text-subtle hover:text-foreground hover:bg-sidebar-accent focus-visible:ring-ring/40 flex size-5 items-center justify-center rounded-md outline-none focus-visible:ring-2"
        >
          <HugeiconsIcon icon={PlusSignIcon} size={13} />
        </button>
      </div>
      <div className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
        {boards?.map((b) => {
          const href = `/boards/${b.id}`;
          const active = pathname === href;
          return (
            <Link key={b.id} href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn(itemClass, active ? activeClass : idleClass)}>
              <HugeiconsIcon icon={DashboardSquare02Icon} size={14} className={cn("shrink-0", active ? "text-brand-text" : "text-subtle")} />
              <span className="truncate">{b.name}</span>
            </Link>
          );
        })}
        {adding ? (
          <input
            autoFocus
            value={name}
            maxLength={120}
            placeholder="Board name"
            aria-label="New board name"
            onChange={(e) => setName(e.target.value)}
            onBlur={() => (name.trim() ? void create() : setAdding(false))}
            onKeyDown={(e) => {
              if (e.key === "Enter") void create();
              if (e.key === "Escape") {
                setName("");
                setAdding(false);
              }
            }}
            className="bg-card placeholder:text-subtle h-7 rounded-[8px] border px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        ) : boards && !boards.length ? (
          <button type="button" onClick={() => setAdding(true)} className={cn(itemClass, idleClass, "text-subtle")}>
            Create a board
          </button>
        ) : null}
      </div>
    </div>
  );
}
