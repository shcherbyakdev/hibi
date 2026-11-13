"use client";

import { useSyncStatus } from "@/lib/sync/provider";
import { cn } from "@/lib/utils";

/* Neutral when all is well (a faint dot), the accent pulsing while changes
   are on their way, a hollow dot when offline. The count says how much is
   waiting. */
export function SyncStatus() {
  const { phase, pending } = useSyncStatus();
  const offline = phase === "offline";
  const busy = !offline && (phase === "syncing" || pending > 0);
  const label = offline
    ? `Offline${pending ? ` · ${pending} change${pending === 1 ? "" : "s"} waiting` : ""}`
    : busy
      ? "Syncing…"
      : "All changes saved";
  return (
    <span role="status" title={label} className="flex size-5 items-center justify-center">
      <span
        className={cn(
          "size-1.5 rounded-[1px] transition-colors duration-300",
          offline ? "ring-subtle ring-1 ring-inset" : busy ? "bg-brand motion-safe:animate-pulse" : "bg-foreground/25",
        )}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
