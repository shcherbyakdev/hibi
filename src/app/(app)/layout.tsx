import { requireUser } from "@/lib/auth/session";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/shell/app-shell";
import { SyncProvider } from "@/lib/sync/provider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <Providers>
      <SyncProvider userId={user.id}>
        <AppShell userEmail={user.email ?? ""}>{children}</AppShell>
      </SyncProvider>
    </Providers>
  );
}
