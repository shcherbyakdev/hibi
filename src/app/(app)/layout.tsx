import { requireUser } from "@/lib/auth/session";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/shell/app-shell";
import { SyncProvider } from "@/lib/sync/provider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Sync outermost: the shell, its boards list and ⌘K all read the local db.
  return (
    <SyncProvider userId={user.id}>
      <Providers>
        <AppShell userEmail={user.email ?? ""}>{children}</AppShell>
      </Providers>
    </SyncProvider>
  );
}
