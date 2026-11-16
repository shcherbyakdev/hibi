export type ToolboxMode = "hidden" | "docked" | "floating";
/** `last` is the visible mode F brings back; x/y = -1 means "bottom-right". */
export type Placement = { mode: ToolboxMode; last: "docked" | "floating"; x: number; y: number };

export const DEFAULT_PLACEMENT: Placement = { mode: "hidden", last: "floating", x: -1, y: -1 };

const MODES: readonly string[] = ["hidden", "docked", "floating"];

/** Stored JSON → placement; anything unexpected is the default. */
export function parsePlacement(raw: string | null): Placement {
  try {
    const v = raw ? JSON.parse(raw) : null;
    if (!v || !MODES.includes(v.mode)) return DEFAULT_PLACEMENT;
    return {
      mode: v.mode,
      last: v.last === "docked" ? "docked" : "floating",
      x: Number.isFinite(v.x) ? v.x : -1,
      y: Number.isFinite(v.y) ? v.y : -1,
    };
  } catch {
    return DEFAULT_PLACEMENT;
  }
}

/** Top-left of a card of `size` so it stays `margin` inside the viewport. */
export function clamp(pos: { x: number; y: number }, size: { w: number; h: number }, viewport: { w: number; h: number }, margin = 8) {
  const fit = (v: number, len: number, room: number) => Math.max(margin, Math.min(v, room - len - margin));
  return { x: fit(pos.x, size.w, viewport.w), y: fit(pos.y, size.h, viewport.h) };
}
