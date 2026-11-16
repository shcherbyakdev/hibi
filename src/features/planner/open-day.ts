import { useEffect, useState } from "react";

/** Grid columns for a week row with one day opened in place. Always an
    explicit list (never `repeat()`) so the change can be transitioned. */
export function openTracks(count: number, openIndex: number): string {
  return Array.from({ length: count }, (_, i) => (i === openIndex ? "minmax(20rem,3fr)" : "minmax(0,1fr)")).join(" ");
}

/** A click on a cell's empty space, not on a control or a draggable task. */
export function isCellBackground(target: { closest(selector: string): unknown } | null): boolean {
  return !target?.closest("button, input, [aria-roledescription]");
}

/** Escape that nothing else (a focused row, an input) already handled. */
export function shouldCloseOnKey(e: { key: string; defaultPrevented: boolean; target: unknown }): boolean {
  if (e.key !== "Escape" || e.defaultPrevented) return false;
  if (typeof HTMLElement === "undefined") return true;
  const t = e.target;
  return !(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable));
}

/** The day opened in place in week/month view. Changing `period` closes it. */
export function useOpenDay(period: string) {
  const [state, setState] = useState<{ period: string; day: string | null }>({ period, day: null });
  // Period changed: forget the open day, so coming back finds it closed.
  if (state.period !== period) setState({ period, day: null });
  const open = state.period === period ? state.day : null;
  const setOpen = (day: string | null) => setState({ period, day });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => shouldCloseOnKey(e) && setState((s) => ({ ...s, day: null }));
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen };
}
