"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSync } from "@/lib/sync/provider";
import { usePrefs } from "@/lib/prefs";
import { useToday } from "@/lib/use-today";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OPEN_COMMAND_MENU_EVENT } from "@/components/command-menu";
import { useItemActions } from "@/features/items/use-items";
import { toggleToolbox } from "@/features/toolbox/use-toolbox";
import { useItemSheet } from "@/features/items/components/item-sheet";
import { INBOX, keyForStep, type Place } from "@/features/items/model";
import { periodOf } from "@/features/planner/periods";
import { PLAN_VIEWS } from "@/features/planner/views";
import { focusQuickAdd } from "@/lib/focus-quick-add";
import { useTimer } from "@/features/time/use-timer";

export const SHORTCUTS: Array<[string, string]> = [
  ["J / K", "Next / previous task"],
  ["X", "Toggle done"],
  ["Enter", "Open details"],
  ["T / W / M", "Plan for today / this week / this month"],
  ["0 – 4", "Priority: none, urgent, high, medium, low"],
  ["U", "Unplan"],
  ["⌥ ↑ / ⌥ ↓", "Move up / down in its list"],
  ["⌫", "Delete (with undo)"],
  ["S", "Start / pause timer"],
  ["P", "Start a 25-min pomodoro"],
  ["C", "New task"],
  ["1 / 2 / 3", "Day / Week / Month (no task focused)"],
  ["← / →", "Previous / next period"],
  ["T", "Jump to today (no task focused)"],
  ["F", "Show / hide the toolbox"],
  ["/ or ⌘K", "Search and commands"],
  ["?", "This list"],
];

/** Keys that act on the focused task (with no modifier). */
const ROW_KEYS = new Set(["x", "Enter", "t", "w", "m", "u", "s", "p", "0", "1", "2", "3", "4", "Backspace", "Delete", "Escape"]);

const rows = () => [...document.querySelectorAll<HTMLElement>("[data-item-id]")];
const idOf = (el: HTMLElement | null) => el?.dataset.itemId;
const click = (selector: string) => document.querySelector<HTMLElement>(selector)?.click();

/* One keydown listener for the app. Task keys act on the FOCUSED row (rows
   are focus stops, see ItemRow), so selection is just browser focus: Tab,
   screen readers and J/K all agree. Keys typed into fields, dialogs and
   menus are left alone; ⌘/Ctrl combos belong to the browser and ⌘K. */
export function Shortcuts() {
  const { db } = useSync();
  const actions = useItemActions();
  const sheet = useItemSheet();
  const router = useRouter();
  const pathname = usePathname();
  const today = useToday();
  const { weekStart } = usePrefs();
  const [help, setHelp] = React.useState(false);
  const timer = useTimer();

  React.useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey) return;
      const target = e.target as HTMLElement;
      if (target.isContentEditable || target.closest("input, textarea, select, [role=dialog], [role=menu], [role=listbox]")) return;
      const row = target.closest<HTMLElement>("[data-item-id]");
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const handled = () => e.preventDefault();

      // Walk rows. Arrows only while on a row, so they still scroll the page otherwise.
      if (!e.altKey && (key === "j" || key === "k" || (row && (key === "ArrowDown" || key === "ArrowUp")))) {
        handled();
        const all = rows();
        const i = row ? all.indexOf(row) : -1;
        const next = key === "j" || key === "ArrowDown" ? all[Math.min(i + 1, all.length - 1)] : all[Math.max(i - 1, 0)];
        next?.focus();
        next?.scrollIntoView({ block: "nearest", inline: "nearest" });
        return;
      }

      const rowKey = ROW_KEYS.has(key) || (e.altKey && (key === "ArrowUp" || key === "ArrowDown"));
      if (row && today && rowKey) {
        // Synchronously, before any await: later is too late to stop the default.
        handled();
        const item = await db.items.get(idOf(row)!);
        if (!item) return;
        // Before a task leaves this list, hand focus to its neighbour.
        const passFocus = () => {
          const all = rows();
          const i = all.indexOf(row);
          (all[i + 1] ?? all[i - 1])?.focus();
        };
        const plan = (place: Place) => {
          handled();
          passFocus();
          void actions.plan(item, place);
        };
        if (e.altKey && (key === "ArrowUp" || key === "ArrowDown")) {
          handled();
          const group = row.closest<HTMLElement>("[data-group]");
          if (!group || group.dataset.group === "overdue" || group.dataset.unordered) return;
          const ids = [...group.querySelectorAll<HTMLElement>("[data-item-id]")].map((el) => idOf(el)!);
          const list = (await db.items.bulkGet(ids)).filter((x) => x !== undefined);
          const k = keyForStep(list, ids.indexOf(item.id), key === "ArrowUp" ? -1 : 1);
          if (k) await actions.reorder(item, k);
          return;
        }
        if (key === "x") return handled(), void actions.toggleDone(item);
        if (/^[0-4]$/.test(key)) return void actions.edit(item, { priority: Number(key) });
        if (key === "s") return void (timer.running?.item_id === item.id ? timer.pause() : timer.start(item.id));
        if (key === "p") return void timer.start(item.id, { pomodoro: true });
        if (key === "Enter") return handled(), sheet.open(item.id);
        if (key === "t") return plan({ plan_scope: "day", plan_date: today });
        if (key === "w") return plan({ plan_scope: "week", plan_date: periodOf("week", today, weekStart) });
        if (key === "m") return plan({ plan_scope: "month", plan_date: periodOf("month", today) });
        if (key === "u") return item.plan_scope ? plan(INBOX) : undefined;
        if (key === "Backspace" || key === "Delete") return handled(), passFocus(), void actions.remove(item);
        if (key === "Escape") return handled(), row.blur();
      }

      if (e.altKey) return;
      if (key === "c") return handled(), void focusQuickAdd(router.push);
      if (key === "1" || key === "2" || key === "3") {
        handled();
        const keep = pathname.startsWith("/plan/") ? window.location.search : "";
        return router.push(`/plan/${PLAN_VIEWS[Number(key) - 1]}${keep}`);
      }
      if (key === "ArrowLeft") return handled(), click("[data-nav=prev]");
      if (key === "ArrowRight") return handled(), click("[data-nav=next]");
      if (key === "t") return handled(), click("[data-nav=today]");
      // S with no task focused: pause the running timer, or resume the paused one.
      if (key === "s" && (timer.running || timer.pausedItemId)) {
        handled();
        return void (timer.running ? timer.pause() : timer.start(timer.pausedItemId!));
      }
      if (key === "f") return handled(), toggleToolbox();
      if (key === "/") return handled(), window.dispatchEvent(new Event(OPEN_COMMAND_MENU_EVENT));
      if (key === "?") return handled(), setHelp(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [db, actions, sheet, router, pathname, today, weekStart, timer]);

  return (
    <Dialog open={help} onOpenChange={setHelp}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <ShortcutList />
      </DialogContent>
    </Dialog>
  );
}

export function ShortcutList() {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[13px]">
      {SHORTCUTS.map(([keys, what]) => (
        <React.Fragment key={what}>
          <dt>
            <kbd className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 font-mono text-[11px]">{keys}</kbd>
          </dt>
          <dd className="text-muted-foreground">{what}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
