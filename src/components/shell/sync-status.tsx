"use client";

import { CloudOff } from "lucide-react";
import { useSyncStatus } from "@/lib/sync/provider";

/* Silent while things are fine — saving takes a fraction of a second, so a
   permanent dot would be noise nobody can decode. When the server can't be
   reached it says so in words, with how many changes are waiting (they're
   safe on this device and go up when the connection is back). Screen
   readers always get the status. */
export function SyncStatus() {
  const { phase, pending } = useSyncStatus();
  const changes = `${pending} change${pending === 1 ? "" : "s"}`;

  if (phase !== "offline")
    return (
      <span role="status" className="sr-only">
        {phase === "syncing" || pending > 0 ? "Syncing…" : "All changes saved"}
      </span>
    );

  return (
    <span
      role="status"
      title={pending ? `Can't reach the server. ${changes} saved on this device will sync when you're back online.` : "Can't reach the server. Changes will sync when you're back online."}
      className="text-muted-foreground bg-muted flex h-5 items-center gap-1 rounded-sm px-1.5 font-mono text-[10.5px] tracking-[0.04em] uppercase"
    >
      <CloudOff className="size-3" aria-hidden />
      Offline{pending ? ` · ${pending}` : ""}
      <span className="sr-only">{pending ? `, ${changes} waiting to sync` : ""}</span>
    </span>
  );
}
