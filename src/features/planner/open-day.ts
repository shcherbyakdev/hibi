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

/** What a click on a month cell means. `detail` is the click count. The
    first click opens the day and swaps its chips for taller cards, so a
    second click may land on a card: where the first one landed decides. */
export function cellClickIntent(detail: number, background: boolean, firstWasBackground: boolean): "open" | "add" | null {
  if (detail === 1) return background ? "open" : null;
  return firstWasBackground ? "add" : null;
}

/** Escape that nothing else (a focused row, an input, a drag) already handled. */
export function shouldCloseOnKey(e: { key: string; defaultPrevented: boolean; target: unknown; dragging?: boolean }): boolean {
  if (e.key !== "Escape" || e.defaultPrevented || e.dragging) return false;
  if (typeof HTMLElement === "undefined") return true;
  const t = e.target;
  return !(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable));
}

type OpenState = { period: string; day: string | null };

/** Close the open day; the same object when none is open, so React skips the render. */
export function closeDay(s: OpenState): OpenState {
  return s.day === null ? s : { ...s, day: null };
}

/** The day opened in place in week/month view. Changing `period` closes it. */
export function useOpenDay(period: string) {
  const [state, setState] = useState<OpenState>({ period, day: null });
  // Period changed: forget the open day, so coming back finds it closed.
  if (state.period !== period) setState({ period, day: null });
  const open = state.period === period ? state.day : null;
  const setOpen = (day: string | null) => setState({ period, day });
  useEffect(() => {
    // dnd-kit marks the item being dragged aria-pressed. Our listener is added
    // at mount, before the sensor's, so it still sees the drag on that Escape.
    const onKey = (e: KeyboardEvent) => {
      const dragging = !!document.querySelector('[aria-roledescription][aria-pressed="true"]');
      if (shouldCloseOnKey({ key: e.key, defaultPrevented: e.defaultPrevented, target: e.target, dragging })) setState(closeDay);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen };
}
