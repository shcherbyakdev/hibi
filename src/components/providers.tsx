"use client";

import { Toaster } from "@/components/ui/sonner";
import { CommandMenu } from "@/components/command-menu";

// ThemeProvider lives in the root layout: mounting it on a client navigation
// (login → app) re-renders its inline script and React warns.
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <CommandMenu />
      <Toaster />
    </>
  );
}
