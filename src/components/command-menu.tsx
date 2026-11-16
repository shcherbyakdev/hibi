"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useLiveQuery } from "dexie-react-hooks";
import { Moon, PanelRight, PictureInPicture2, Plus, Sun, X } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon, CircleIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { NAV_ITEMS } from "@/components/shell/nav";
import { useSync } from "@/lib/sync/provider";
import { focusQuickAdd } from "@/lib/focus-quick-add";
import { useGoals } from "@/features/goals/use-goals";
import { toneClass } from "@/lib/tone";
import { useItemSheet } from "@/features/items/components/item-sheet";
import { isLive, placeLabel } from "@/features/items/model";
import { PriorityIcon } from "@/features/items/components/priority-icon";
import { useTimer } from "@/features/time/use-timer";
import { setToolboxMode, useToolbox } from "@/features/toolbox/use-toolbox";
import { Pause, Play } from "lucide-react";

/** Dispatched on `window` by the sidebar's search button and "/"; toggles like ⌘K. */
export const OPEN_COMMAND_MENU_EVENT = "todo:open-command-menu";

const MAX_TASKS = 30;

export function CommandMenu() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { db } = useSync();
  const goals = useGoals();
  const sheet = useItemSheet();
  const timer = useTimer();
  const toolbox = useToolbox();

  // Tasks are searched in the local db, only while the menu is open and the
  // query isn't empty. Pre-filtered to a short list so cmdk ranks dozens, not
  // thousands. ponytail: substring match on title; add notes / fuzzy if needed.
  const q = query.trim().toLowerCase();
  const tasks = useLiveQuery(
    async () => (open && q ? (await db.items.filter((i) => isLive(i) && i.title.toLowerCase().includes(q)).limit(MAX_TASKS).toArray()) : []),
    [db, open, q],
    [],
  );

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

  const run = (fn: () => void) => {
    setOpen(false);
    setQuery("");
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={(o) => (setOpen(o), o || setQuery(""))}>
      <CommandInput placeholder="Search tasks, goals, commands…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        {tasks.length ? (
          <CommandGroup heading="Tasks">
            {tasks.map((t) => (
              <CommandItem key={t.id} value={`task ${t.title} ${t.id}`} onSelect={() => run(() => sheet.open(t.id))}>
                <HugeiconsIcon icon={t.status === "done" ? CheckmarkCircle02Icon : CircleIcon} size={16} />
                <span className={t.status === "done" ? "text-muted-foreground line-through" : undefined}>{t.title}</span>
                <PriorityIcon priority={t.priority} />
                {t.plan_scope ? <span className="text-subtle ml-auto text-xs">{placeLabel(t)}</span> : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        <CommandGroup heading="Actions">
          {timer.running ? (
            <CommandItem value="pause timer stop" onSelect={() => run(() => void timer.pause())}>
              <Pause className="size-4" /> Pause timer
            </CommandItem>
          ) : timer.pausedItemId ? (
            <CommandItem value="resume timer continue" onSelect={() => run(() => void timer.start(timer.pausedItemId!))}>
              <Play className="size-4" /> Resume timer
            </CommandItem>
          ) : null}
          <CommandItem value="new task create add" onSelect={() => run(() => void focusQuickAdd(router.push))}>
            <Plus className="size-4" /> New task
          </CommandItem>
          {toolbox.mode !== "docked" ? (
            <CommandItem value="dock toolbox pomodoro focus panel" onSelect={() => run(() => setToolboxMode("docked"))}>
              <PanelRight className="size-4" /> Dock toolbox
            </CommandItem>
          ) : null}
          {toolbox.mode !== "floating" ? (
            <CommandItem value="float toolbox pomodoro focus widget" onSelect={() => run(() => setToolboxMode("floating"))}>
              <PictureInPicture2 className="size-4" /> Float toolbox
            </CommandItem>
          ) : null}
          {toolbox.mode !== "hidden" ? (
            <CommandItem value="hide toolbox close" onSelect={() => run(() => setToolboxMode("hidden"))}>
              <X className="size-4" /> Hide toolbox
            </CommandItem>
          ) : null}
          <CommandItem
            value="toggle theme dark light"
            onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}
          >
            {resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            Toggle theme
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Go to">
          {(["day", "week", "month"] as const).map((v) => (
            <CommandItem key={v} value={`planner ${v}`} onSelect={() => run(() => router.push(`/plan/${v}`))}>
              <HugeiconsIcon icon={NAV_ITEMS[0].icon} size={16} /> Planner · <span className="capitalize">{v}</span>
            </CommandItem>
          ))}
          {NAV_ITEMS.slice(1).map((item) => (
            <CommandItem key={item.href} onSelect={() => run(() => router.push(item.href))}>
              <HugeiconsIcon icon={item.icon} size={16} /> {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {goals?.length ? (
          <CommandGroup heading="Goals">
            {goals.map((g) => (
              <CommandItem key={g.id} value={`goal ${g.name} ${g.id}`} onSelect={() => run(() => router.push(`/goals/${g.id}`))}>
                <span aria-hidden className={cn("size-2.5 rounded-[1px] bg-current", toneClass(g))} /> {g.name}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
