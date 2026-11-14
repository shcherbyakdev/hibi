"use client";

import { Repeat } from "lucide-react";
import { useRoutine } from "../use-routines";

/** On a routine's copy while the routine still runs; nothing once stopped. */
export function RepeatIcon({ id }: { id: string }) {
  const routine = useRoutine(id);
  if (!routine) return null;
  return <Repeat aria-label="Repeats" className="text-subtle size-3.5 shrink-0" />;
}
