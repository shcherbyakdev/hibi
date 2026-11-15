"use client";

import { usePathname } from "next/navigation";
import { GoalView } from "./goal-view";

/** The goal id comes from the URL, not route params: the desktop export has
    one placeholder page (goals/_) served for every /goals/<id>, and only
    usePathname() sees the real id there (spike, 2026-11-15). The hosted
    site reads it the same way. */
export function GoalRoute() {
  const id = decodeURIComponent(usePathname().split("/")[2] ?? "");
  return <GoalView key={id} id={id} />;
}
