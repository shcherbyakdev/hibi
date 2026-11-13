import { SidebarBody } from "./sidebar-body";
import { TopBar } from "./top-bar";

/* Linear-style shell: the viewport ground is the sidebar surface and the
   content lives in a rounded, hairline-bordered panel floating on it. The
   panel scrolls internally, so the header stays put without sticky. Below
   md the panel goes full-bleed and the sidebar moves into a sheet. */
export function AppShell({ userEmail, children }: { userEmail: string; children: React.ReactNode }) {
  return (
    <div className="bg-sidebar flex h-dvh w-full">
      <aside className="text-sidebar-foreground hidden w-[244px] shrink-0 flex-col md:flex">
        <SidebarBody userEmail={userEmail} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col md:p-2 md:pl-0">
        <div className="bg-background flex min-h-0 flex-1 flex-col overflow-hidden md:rounded-[12px] md:border md:shadow-(--shadow-card)">
          <TopBar userEmail={userEmail} />
          {/* `relative` so absolutely-positioned descendants (sr-only inputs,
              popovers) resolve against this scroller, not the page. */}
          <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
