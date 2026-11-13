import { WEEK_START } from "@/features/planner/periods";

/** Per-user preferences, stored in Supabase user_metadata so every device
    agrees. Plain module: the server layout parses them, the client reads
    them through PrefsProvider (lib/prefs.tsx). */
export type Prefs = { weekStart: 0 | 1 };

export const DEFAULT_PREFS: Prefs = { weekStart: WEEK_START };

export function prefsFrom(metadata: Record<string, unknown> | undefined): Prefs {
  const ws = metadata?.week_start;
  return { weekStart: ws === 0 || ws === 1 ? ws : DEFAULT_PREFS.weekStart };
}
