"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Logout03Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { NAV_ITEMS, NAV_SECTIONS } from "./nav";
import { signOut } from "@/features/auth/actions";
import { OPEN_COMMAND_MENU_EVENT } from "@/components/command-menu";
import { cn } from "@/lib/utils";
import { SyncStatus } from "./sync-status";
import { activeClass, idleClass, itemClass } from "./sidebar-styles";
import { SidebarBoards } from "@/features/boards/components/sidebar-boards";
import { usePlannerHref } from "@/features/planner/last-view";


export function SidebarBody({ userEmail, onNavigate }: { userEmail: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const plannerHref = usePlannerHref();

  return (
    <div className="flex h-full flex-col px-3 py-4">
      <div className="flex h-9 items-center gap-2.5 px-1.5 pr-8 md:pr-1.5">
        <span aria-hidden="true" className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold">
          {(userEmail[0] ?? "?").toUpperCase()}
        </span>
        <span className="truncate text-[13.5px] font-semibold tracking-[-0.01em]">todo</span>
        <span className="ml-auto">
          <SyncStatus />
        </span>
      </div>

      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_MENU_EVENT))}
        className="bg-card text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 mt-3 flex h-7 w-full items-center gap-2.5 rounded-[8px] border px-2 text-[13px] shadow-(--shadow-lift) transition-colors duration-150 ease-strong outline-none focus-visible:ring-2"
      >
        <HugeiconsIcon icon={Search01Icon} size={14} className="shrink-0" />
        <span className="flex-1 text-left">Search</span>
        <kbd className="text-subtle font-mono text-[10px]">⌘K</kbd>
      </button>

      <nav aria-label="Main" className="mt-5 flex min-h-0 flex-1 flex-col gap-5">
        {NAV_SECTIONS.map((section) => (
          <React.Fragment key={section}>
          {section === "account" ? <SidebarBoards onNavigate={onNavigate} /> : null}
          <div className={cn("flex flex-col gap-0.5", section === "account" && "mt-auto")}>
            {NAV_ITEMS.filter((i) => i.section === section).map(({ href, label, icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href === "/plan" ? plannerHref : href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(itemClass, active ? activeClass : idleClass)}
                >
                  <HugeiconsIcon icon={icon} size={14} className={cn("shrink-0", active ? "text-brand-text" : "text-subtle")} />
                  {label}
                </Link>
              );
            })}
          </div>
          </React.Fragment>
        ))}
      </nav>

      <div className="flex flex-col gap-1 pt-2">
        <div className="text-subtle truncate px-2.5 text-xs" title={userEmail}>
          {userEmail}
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="text-muted-foreground hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-ring/40 flex h-7 w-full items-center gap-2 rounded-[8px] px-2 text-xs transition-colors duration-150 ease-strong outline-none focus-visible:ring-2"
          >
            <HugeiconsIcon icon={Logout03Icon} size={15} className="text-subtle" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
