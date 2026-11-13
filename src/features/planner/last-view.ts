"use client";

import { useSyncExternalStore } from "react";
import { isPlanView, type PlanView } from "./views";

// Which planner view to open from the sidebar: the one used last, on this
// device (a per-device convenience, so localStorage, not the account).
const KEY = "todo:plan-view";

export function rememberPlanView(view: PlanView) {
  try {
    localStorage.setItem(KEY, view);
  } catch {
    // Private mode / blocked storage: just don't remember.
  }
}

const read = () => {
  try {
    const v = localStorage.getItem(KEY);
    return v && isPlanView(v) ? `/plan/${v}` : "/plan/day";
  } catch {
    return "/plan/day";
  }
};
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};

export const usePlannerHref = () => useSyncExternalStore(subscribe, read, () => "/plan/day");
