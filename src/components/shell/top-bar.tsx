"use client";

import { usePathname } from "next/navigation";
import { MobileNav } from "./mobile-nav";
import { titleForPath } from "./nav";
import { PAGE_ACTIONS_ID } from "./page-actions";
import { TimerBar } from "@/features/time/components/timer-bar";

/* Panel header row, Linear-style: hairline underneath, view title at 13px/500.
   Sits above the panel's scroll container, so it needs no sticky. */
export function TopBar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b px-4 md:px-6">
      <MobileNav userEmail={userEmail} />
      <h1 className="text-muted-foreground font-mono text-[11px] uppercase tracking-[0.06em]">{titleForPath(pathname)}</h1>
      {/* Where a page puts its own actions (PageActions portals into it). */}
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <TimerBar />
        <div id={PAGE_ACTIONS_ID} className="flex items-center gap-2" />
      </div>
    </header>
  );
}
