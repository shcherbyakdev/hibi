"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_PLACEMENT, parsePlacement, type Placement, type ToolboxMode } from "./placement";

// Per device, like the paused task in use-timer: a laptop and a big monitor
// want different placements. localStorage + an in-tab event so every reader agrees.
const KEY = "todo:toolbox";
export const TOOLBOX_EVENT = "todo:toolbox-change";

let cache: { raw: string | null; value: Placement } = { raw: null, value: DEFAULT_PLACEMENT };
const read = (): Placement => {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {}
  // Same string → same object, so useSyncExternalStore doesn't loop.
  if (raw !== cache.raw) cache = { raw, value: parsePlacement(raw) };
  return cache.value;
};
const write = (p: Placement) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
  window.dispatchEvent(new Event(TOOLBOX_EVENT));
};
const subscribe = (cb: () => void) => {
  window.addEventListener(TOOLBOX_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(TOOLBOX_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};

/** Module-level so keyboard and ⌘K handlers can call them without the hook. */
export const setToolboxMode = (mode: ToolboxMode) => write({ ...read(), mode, ...(mode !== "hidden" && { last: mode }) });
export const toggleToolbox = () => {
  const cur = read();
  write({ ...cur, mode: cur.mode === "hidden" ? cur.last : "hidden" });
};
const moveTo = (x: number, y: number) => write({ ...read(), x, y });

export function useToolbox() {
  const p = useSyncExternalStore(subscribe, read, () => DEFAULT_PLACEMENT);
  return { ...p, setMode: setToolboxMode, toggle: toggleToolbox, moveTo };
}
