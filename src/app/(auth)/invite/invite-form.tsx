"use client";

import { useActionState, useEffect, useState } from "react";
import { acceptInvite, setPassword } from "@/features/auth/actions";
import type { AuthState } from "@/features/auth/schema";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FormError, PasswordField } from "../fields";

const initial: AuthState = {};
const INVALID = "This invite link has expired or was already used. Ask for a new one.";

/** With `token` (custom email template): verified on submit. Without it
    (Supabase's default email): the session arrives in the #fragment. */
export function InviteForm({ token }: { token?: string }) {
  const [state, action, pending] = useActionState(token ? acceptInvite : setPassword, initial);
  const [ready, setReady] = useState<boolean | null>(token ? true : null);

  useEffect(() => {
    if (token) return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    history.replaceState(null, "", window.location.pathname); // tokens out of the address bar
    const supabase = createClient();
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    const session =
      params.get("type") === "invite" && access_token && refresh_token
        ? supabase.auth.setSession({ access_token, refresh_token }).then((r) => !r.error)
        : // Reloaded after the fragment was cleared: the session is in cookies.
          supabase.auth.getUser().then((r) => !r.error && !!r.data.user);
    session.then(setReady, () => setReady(false));
  }, [token]);

  if (ready === null) return <p className="text-muted-foreground text-sm">Checking your invite…</p>;
  if (!ready) return <p className="text-destructive text-sm">{INVALID}</p>;
  return (
    <form action={action} className="flex flex-col gap-4">
      {token ? <input type="hidden" name="token" value={token} /> : null}
      <PasswordField isNew />
      <FormError error={state.error} />
      <Button type="submit" disabled={pending} className="h-11">
        {pending ? "Saving…" : "Set password and continue"}
      </Button>
    </form>
  );
}
