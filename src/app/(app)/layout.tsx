import { requireUser } from "@/lib/auth/session";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/shell/app-shell";
import { SyncProvider } from "@/lib/sync/provider";
import { RoutineRunner } from "@/features/routines/use-routine-runner";
import { PrefsProvider } from "@/lib/prefs";
import { prefsFrom } from "@/lib/prefs-data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Sync outermost: the shell, its boards list and ⌘K all read the local db.
  return (
    <PrefsProvider prefs={prefsFrom(user.user_metadata)}>
      <SyncProvider userId={user.id}>
        <RoutineRunner />
        <Providers>
          <AppShell userEmail={user.email ?? ""}>{children}</AppShell>
        </Providers>
      </SyncProvider>
    </PrefsProvider>
  );
}
