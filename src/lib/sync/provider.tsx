"use client";

import { createContext, use, useEffect, useState, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { localDbFor, type LocalDb } from "./db";
import { createSyncEngine, type SyncEngine } from "./engine";
import { createSupabaseTransport } from "./supabase-transport";
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
      transport: createSupabaseTransport(createClient(), userId),
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

/** For sign-out: push what's unsynced, then delete this device's copy (the
    IndexedDB database and the `todo:*` localStorage keys) so the next
    person on a shared browser sees nothing. Returns how many changes are
    still unsynced; with any left it deletes nothing unless `force`. */
export function useForgetDevice() {
  const { db, engine } = useSync();
  return async (force = false): Promise<number> => {
    engine.sync({ pull: false });
    // A few seconds is plenty online; offline it simply runs out.
    for (let t = 0; t < 5000 && (await db.outbox.count()) > 0; t += 200) await new Promise((r) => setTimeout(r, 200));
    const left = await db.outbox.count();
    if (left > 0 && !force) return left;
    engine.stop();
    await db.delete({ disableAutoOpen: true });
    try {
      for (const key of Object.keys(localStorage)) if (key.startsWith("todo:")) localStorage.removeItem(key);
    } catch {
      // Storage blocked: nothing of ours is in it.
    }
    return 0;
  };
}
