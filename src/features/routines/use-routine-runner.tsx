"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useSync, useSyncStatus } from "@/lib/sync/provider";
import { useToday } from "@/lib/use-today";
import { ensureToday } from "./generate";

/** Makes today's routine copies: on open, at midnight (useToday ticks), and
    when routines change. Waits for this session's first sync to finish
    (or for the device to be offline), so it doesn't race a pull that
    would bring copies other devices already made — and ticked. */
export function RoutineRunner() {
  const { db, mutations } = useSync();
  const { phase } = useSyncStatus();
  const today = useToday();
  // Changes whenever any routine is written (created, edited, deleted).
  const routinesVersion = useLiveQuery(async () => (await db.routines.toArray()).map((r) => r.updated_at).join(), [db]);
  const [synced, setSynced] = useState(false);
  if (phase === "syncing" && !synced) setSynced(true); // state adjusted during render
  const running = useRef(false);
  const ready = phase === "offline" || (synced && phase === "idle");

  useEffect(() => {
    if (!ready || !today || routinesVersion === undefined || running.current) return;
    running.current = true;
    void ensureToday(db, mutations, today).finally(() => {
      running.current = false;
    });
  }, [ready, today, routinesVersion, db, mutations]);

  return null;
}
