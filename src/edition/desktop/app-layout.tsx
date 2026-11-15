"use client";

import { Providers } from "@/components/providers";
import { AppShell } from "@/components/shell/app-shell";
import { SyncProvider } from "@/lib/sync/provider";
import { RoutineRunner } from "@/features/routines/use-routine-runner";
import { LOCAL_USER_ID } from "@/lib/edition";
import { DesktopPrefsProvider } from "./prefs";
import { UpdateToast } from "./update-toast";

/** Desktop edition: one person per install, no sign-in; data syncs with
    the app's built-in service (desktop/syncsvc). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DesktopPrefsProvider>
      <SyncProvider userId={LOCAL_USER_ID}>
        <RoutineRunner />
        <Providers>
          <UpdateToast />
          <AppShell userEmail="">{children}</AppShell>
        </Providers>
      </SyncProvider>
    </DesktopPrefsProvider>
  );
}
