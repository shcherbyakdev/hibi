"use client";

import { useEffect } from "react";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/shell/app-shell";
import { SyncProvider, useSync } from "@/lib/sync/provider";
import { createHttpTransport } from "@/lib/sync/http-transport";
import { RoutineRunner } from "@/features/routines/use-routine-runner";
import { LOCAL_USER_ID } from "@/lib/edition";
import { AccountProvider, useAccount } from "./account";
import { mergeLocal } from "./merge";
import { DesktopPrefsProvider } from "./prefs";
import { UpdateToast } from "./update-toast";

/** Desktop edition: no sign-in needed. Without an account, data syncs with
    the app's built-in service (desktop/syncsvc) only; signed in, with the
    hosted site, like any browser. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AccountProvider>
      <Shell>{children}</Shell>
    </AccountProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const user = useAccount();
  if (user === undefined) return null; // reading the saved session: a frame or two
  const userId = user?.id ?? LOCAL_USER_ID;
  return (
    <DesktopPrefsProvider>
      {/* Keyed: signing in or out swaps the local db, engine and transport. */}
      <SyncProvider key={userId} userId={userId}>
        {user ? <MergeLocal userId={userId} /> : null}
        <RoutineRunner />
        <Providers>
          <UpdateToast />
          <AppShell userEmail={user?.email ?? ""}>{children}</AppShell>
        </Providers>
      </SyncProvider>
    </DesktopPrefsProvider>
  );
}

/** Signed in: take what this Mac holds into the account (merge.ts), then
    let the engine push it. */
function MergeLocal({ userId }: { userId: string }) {
  const { db, engine } = useSync();
  useEffect(() => {
    mergeLocal(db, createHttpTransport(""), userId).then(
      (taken) => taken && engine.kick(),
      (e) => console.error("[merge]", e), // retried on the next launch
    );
  }, [db, engine, userId]);
  return null;
}
