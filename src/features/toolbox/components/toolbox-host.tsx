"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { PanelRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { clamp } from "../placement";
import { useToolbox } from "../use-toolbox";
import { Toolbox } from "./toolbox";

const WIDTH = 320;

// md breakpoint (48rem). Docked needs the room; below it docked floats.
const MD = "(min-width: 48rem)";
const subscribeMd = (cb: () => void) => {
  const q = window.matchMedia(MD);
  q.addEventListener("change", cb);
  return () => q.removeEventListener("change", cb);
};
const useWide = () => React.useSyncExternalStore(subscribeMd, () => window.matchMedia(MD).matches, () => true);

/** The docked toolbox: a column right of the content panel, on the sidebar ground. */
export function ToolboxDock() {
  const { mode } = useToolbox();
  const wide = useWide();
  if (mode !== "docked" || !wide) return null;
  return (
    <aside aria-label="Toolbox" className="flex w-[320px] shrink-0 flex-col overflow-y-auto py-2 pr-2">
      <Toolbox />
    </aside>
  );
}

/** The floating toolbox: a fixed card dragged by its header, kept on screen. */
export function ToolboxFloat() {
  const { mode, x, y, moveTo, setMode } = useToolbox();
  const wide = useWide();
  const ref = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{ dx: number; dy: number } | null>(null);
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null);
  const visible = mode === "floating" || (mode === "docked" && !wide);

  // Place from storage (x = -1 → bottom-right) and keep it on screen when
  // the window shrinks.
  React.useLayoutEffect(() => {
    if (!visible) return;
    const place = () => {
      const el = ref.current;
      if (!el) return;
      const size = { w: el.offsetWidth, h: el.offsetHeight };
      const view = { w: window.innerWidth, h: window.innerHeight };
      setPos(clamp(x < 0 ? { x: view.w, y: view.h } : { x, y }, size, view, 16));
    };
    place();
    // Also when the card itself grows (tasks load, a row is added).
    const ro = new ResizeObserver(place);
    if (ref.current) ro.observe(ref.current);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [visible, x, y]);

  if (!visible) return null;

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button, a, input") || !pos) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (drag.current) setPos({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy });
  };
  const onPointerUp = () => {
    if (!drag.current || !pos || !ref.current) return;
    drag.current = null;
    const p = clamp(pos, { w: ref.current.offsetWidth, h: ref.current.offsetHeight }, { w: window.innerWidth, h: window.innerHeight }, 16);
    setPos(p);
    moveTo(p.x, p.y);
  };

  return createPortal(
    <div
      ref={ref}
      role="region"
      aria-label="Toolbox"
      onKeyDown={(e) => e.key === "Escape" && setMode("hidden")}
      style={{ left: pos?.x ?? 0, top: pos?.y ?? 0, width: WIDTH }}
      className={cn("bg-sidebar fixed z-40 max-h-[calc(100dvh-32px)] overflow-y-auto rounded-md p-2 shadow-(--shadow-lift)", !pos && "invisible")}
    >
      <Toolbox dragHandleProps={{ onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp }} />
    </div>,
    document.body,
  );
}

/** Top-bar toggle: shows or hides the toolbox in its last placement. */
export function ToolboxButton() {
  const { mode, toggle } = useToolbox();
  return (
    <button
      type="button"
      aria-label="Toolbox"
      aria-pressed={mode !== "hidden"}
      title="Toolbox (F)"
      onClick={toggle}
      className="text-muted-foreground hover:text-foreground hover:bg-muted aria-pressed:text-foreground aria-pressed:bg-muted focus-visible:ring-ring/40 flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-2"
    >
      <PanelRight className="size-4" />
    </button>
  );
}
