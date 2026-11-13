"use client";

import { Toaster } from "@/components/ui/sonner";
import { CommandMenu } from "@/components/command-menu";
import { Shortcuts } from "@/components/shortcuts";
import { ItemSheetProvider } from "@/features/items/components/item-sheet";
import { TimerProvider } from "@/features/time/use-timer";

// ThemeProvider lives in the root layout: mounting it on a client navigation
// (login → app) re-renders its inline script and React warns.
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TimerProvider>
      <ItemSheetProvider>
        {children}
        <CommandMenu />
        <Shortcuts />
        <Toaster />
      </ItemSheetProvider>
    </TimerProvider>
  );
}
