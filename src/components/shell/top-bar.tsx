"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { MobileNav } from "./mobile-nav";
import { parentFor, titleForPath } from "./nav";
import { PAGE_ACTIONS_ID } from "./page-actions";
import { TimerBar } from "@/features/time/components/timer-bar";
import { ToolboxButton } from "@/features/toolbox/components/toolbox-host";

/* Panel header row, Linear-style: hairline underneath, view title at 13px/500.
   Sits above the panel's scroll container, so it needs no sticky. */
export function TopBar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const parent = parentFor(pathname);
  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b px-4 md:px-6">
      <MobileNav userEmail={userEmail} />
      <h1 className="text-muted-foreground font-mono text-[11px] uppercase tracking-[0.06em]">
        {parent ? (
          // A detail page: the title is the way back to its list.
          <Link
            href={parent.href}
            aria-label={`Back to ${parent.label}`}
            className="hover:text-foreground focus-visible:text-foreground -ml-1.5 flex h-7 items-center gap-1 rounded-md pr-1.5 pl-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <ChevronLeft aria-hidden className="size-4" />
            {parent.label}
          </Link>
        ) : (
          titleForPath(pathname)
        )}
      </h1>
      {/* Where a page puts its own actions (PageActions portals into it). */}
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <TimerBar />
        <ToolboxButton />
        <div id={PAGE_ACTIONS_ID} className="flex items-center gap-2" />
      </div>
    </header>
  );
}
