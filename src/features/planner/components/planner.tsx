"use client";

import { useRouter } from "next/navigation";
import type { PlanView } from "../views";
import { usePlanDate } from "../use-plan-date";
import { DayView } from "./day-view";
import { WeekView } from "./week-view";
import { MonthView } from "./month-view";

export function Planner({ view }: { view: PlanView }) {
  const pd = usePlanDate();
  const router = useRouter();
  if (!pd) return null;
  if (view === "day") return <DayView {...pd} />;
  if (view === "week") return <WeekView {...pd} />;
  return <MonthView {...pd} openDay={(d) => router.push(`/plan/day?d=${d}`)} />;
}
