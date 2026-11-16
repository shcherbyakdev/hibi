"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Logout03Icon } from "@hugeicons/core-free-icons";
import { useForgetDevice } from "@/lib/sync/provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/* Sign out = push unsynced changes, clear this device's copy, end the
   session. If changes can't be pushed (offline), ask before losing them.
   `signOut` ends the session and moves on (hosted: the server action, which
   redirects to /login; desktop: back to this Mac's own data). */
export function SignOutButton({ signOut }: { signOut: () => Promise<void> }) {
  const forget = useForgetDevice();
  const [busy, setBusy] = React.useState(false);
  const [unsynced, setUnsynced] = React.useState(0);

  const run = async (force = false) => {
    setBusy(true);
    const left = await forget(force);
    if (left > 0) {
      setUnsynced(left);
      setBusy(false);
      return;
    }
    await signOut();
  };

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => void run()}
        className="text-muted-foreground hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-ring/40 flex h-7 w-full items-center gap-2.5 rounded-md px-2 text-xs transition-colors duration-150 ease-strong outline-none focus-visible:ring-2 disabled:opacity-60"
      >
        <HugeiconsIcon icon={Logout03Icon} size={14} className="text-subtle" />
        {busy ? "Signing out…" : "Sign out"}
      </button>
      <Dialog open={unsynced > 0} onOpenChange={(o) => !o && setUnsynced(0)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {unsynced} change{unsynced === 1 ? " hasn’t" : "s haven’t"} synced yet
            </DialogTitle>
            <DialogDescription>Signing out deletes this device&apos;s copy, including changes that haven&apos;t reached the server. Reconnect and they&apos;ll sync on their own.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnsynced(0)}>
              Stay signed in
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setUnsynced(0);
                void run(true);
              }}
            >
              Sign out anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
