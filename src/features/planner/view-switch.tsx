"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SEGMENTED_NAV_CLASS, segmentedItemClass } from "@/components/ui/segmented";

import { PLAN_VIEWS, type PlanView } from "./views";

/* Day / Week / Month as links on the segmented pill. Each view is its own
   route (linkable, prefetched); the viewed date (?d) rides along. */
export function PlanViewSwitch({ current }: { current: PlanView }) {
  const d = useSearchParams().get("d");
  return (
    <nav aria-label="Planner view" className={SEGMENTED_NAV_CLASS}>
      {PLAN_VIEWS.map((v) => (
        <Link
          key={v}
          href={d ? `/plan/${v}?d=${d}` : `/plan/${v}`}
          aria-current={v === current ? "page" : undefined}
          className={segmentedItemClass(v === current, "capitalize")}
        >
          {v}
        </Link>
      ))}
    </nav>
  );
}
