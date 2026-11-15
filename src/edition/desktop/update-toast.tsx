"use client";

import { useEffect } from "react";
import { toast } from "sonner";

const DAY = 24 * 60 * 60 * 1000;
const ID = "hibi-update";

type Status = { available: boolean; version?: string; notes?: string; error?: string };

// POSTs must be JSON: the service refuses anything else (no-cors guard).
const post = (path: string) => fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });

/** hibi.app's updater (desktop/update): check on launch and daily, and
    let the person choose when to restart. If installing fails, offer the
    release page in the browser instead. */
export function UpdateToast() {
  useEffect(() => {
    const check = async () => {
      const st: Status | null = await fetch("/app/update")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null); // offline or no release yet: try again tomorrow
      if (!st?.available) return;
      toast(`Update available: hibi ${st.version}`, {
        id: ID,
        description: st.notes || undefined,
        duration: Infinity,
        action: { label: "Restart", onClick: () => void install() },
      });
    };
    void check();
    const timer = setInterval(check, DAY);
    return () => clearInterval(timer);
  }, []);
  return null;
}

async function install() {
  toast.loading("Updating hibi…", { id: ID, duration: Infinity });
  const res = await post("/app/update").catch(() => null);
  if (res?.status === 202) return; // the app quits and reopens on the new version
  const st: Status | null = res ? await res.json().catch(() => null) : null;
  toast.error("Couldn't update hibi", {
    id: ID,
    description: st?.error ?? "The old version is still installed.",
    duration: Infinity,
    action: { label: "Download", onClick: () => void post("/app/releases") },
  });
}
