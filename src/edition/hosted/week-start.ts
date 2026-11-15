"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Saves week start to the account (user_metadata), then re-reads the layout. */
export function useSaveWeekStart() {
  const router = useRouter();
  return async (ws: 0 | 1): Promise<boolean> => {
    const { error } = await createClient().auth.updateUser({ data: { week_start: ws } });
    if (error) return false;
    router.refresh();
    return true;
  };
}

export const WEEK_START_HINT = "Saved to your account, so all your devices agree.";
