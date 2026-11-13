"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { NAV_ITEMS } from "@/components/shell/nav";
import { DashboardSquare02Icon } from "@hugeicons/core-free-icons";
import { useBoards } from "@/features/boards/use-boards";

/** Dispatched on `window` by the sidebar's search button; toggles like ⌘K. */
export const OPEN_COMMAND_MENU_EVENT = "todo:open-command-menu";

export function CommandMenu() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const boards = useBoards();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen((o) => !o);
    document.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_COMMAND_MENU_EVENT, onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_COMMAND_MENU_EVENT, onOpen);
    };
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Go to">
          {NAV_ITEMS.map((item) => (
            <CommandItem key={item.href} onSelect={() => go(item.href)}>
              <HugeiconsIcon icon={item.icon} size={16} /> {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {boards?.length ? (
          <CommandGroup heading="Boards">
            {boards.map((b) => (
              <CommandItem key={b.id} value={`board ${b.name} ${b.id}`} onSelect={() => go(`/boards/${b.id}`)}>
                <HugeiconsIcon icon={DashboardSquare02Icon} size={16} /> {b.name}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        <CommandGroup heading="Preferences">
          <CommandItem
            onSelect={() => {
              setTheme(resolvedTheme === "dark" ? "light" : "dark");
              setOpen(false);
            }}
          >
            {resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            Toggle theme
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
