"use client";

import { createContext, use, useEffect, useState, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { localDbFor, type LocalDb } from "./db";
import { createSyncEngine, type SyncEngine } from "./engine";
import { createMutations, type Mutations } from "./mutate";

type Sync = { db: LocalDb; engine: SyncEngine; mutations: Mutations };
const SyncContext = createContext<Sync | null>(null);

/** Owns the signed-in user's local db and sync engine. Constructing them does
    no I/O (safe during SSR); the engine starts in the effect, client-only. */
export function SyncProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [sync] = useState<Sync>(() => {
    const db = localDbFor(userId);
    const engine = createSyncEngine({
      db,
      supabase: createClient(),
      userId,
      onReject: (r) => {
        console.error(`[sync] ${r.table} ${r.id} rejected:`, r.error);
        toast.error("A change couldn't be saved and was undone.");
      },
    });
    return { db, engine, mutations: createMutations(db, userId, engine.kick) };
  });

  useEffect(() => {
    const { engine } = sync;
    engine.start();
    const resync = () => engine.sync();
    const onVisible = () => document.visibilityState === "visible" && resync();
    window.addEventListener("online", resync);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", resync);
      document.removeEventListener("visibilitychange", onVisible);
      engine.stop();
    };
  }, [sync]);

  return <SyncContext value={sync}>{children}</SyncContext>;
}

export function useSync(): Sync {
  const sync = use(SyncContext);
  if (!sync) throw new Error("useSync outside <SyncProvider>");
  return sync;
}

/** Phase from the engine, plus how many local writes are still unpushed. */
export function useSyncStatus() {
  const { db, engine } = useSync();
  const phase = useSyncExternalStore(engine.subscribe, engine.getPhase, () => "idle" as const);
  const pending = useLiveQuery(() => db.outbox.count(), [db], 0);
  return { phase, pending };
}
