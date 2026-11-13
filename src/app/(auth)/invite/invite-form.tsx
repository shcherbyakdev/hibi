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
  // null: checking; false: invalid; { confirm }: waiting for a yes before
  // replacing another signed-in account; { email }: ready.
  const [view, setView] = useState<null | false | { email?: string; confirm?: () => void; current?: string }>(token ? {} : null);

  useEffect(() => {
    if (token) return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    history.replaceState(null, "", window.location.pathname); // tokens out of the address bar
    const supabase = createClient();
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    const fail = () => setView(false);
    const showUser = () => supabase.auth.getUser().then((r) => setView(!r.error && r.data.user ? { email: r.data.user.email } : false), fail);

    if (params.get("type") !== "invite" || !access_token || !refresh_token) return void showUser(); // reload: session in cookies
    const adopt = () => supabase.auth.setSession({ access_token, refresh_token }).then((r) => (r.error ? fail() : showUser()), fail);
    // A link can carry anyone's session: never silently replace the account
    // this browser is already signed in to (login CSRF).
    supabase.auth.getUser().then((r) => (r.data.user ? setView({ current: r.data.user.email, confirm: adopt }) : adopt()), adopt);
  }, [token]);

  if (view === null) return <p className="text-muted-foreground text-sm">Checking your invite…</p>;
  if (view === false) return <p className="text-destructive text-sm">{INVALID}</p>;
  if (view.confirm)
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm">This browser is signed in as {view.current}. Sign out of it and open the invite?</p>
        <Button onClick={() => (setView(null), view.confirm!())} className="h-11">
          Continue with the invite
        </Button>
      </div>
    );
  return (
    <form action={action} className="flex flex-col gap-4">
      {view.email ? <p className="text-sm">Setting up <span className="font-medium">{view.email}</span></p> : null}
      {token ? <input type="hidden" name="token" value={token} /> : null}
      <PasswordField isNew />
      <FormError error={state.error} />
      <Button type="submit" disabled={pending} className="h-11">
        {pending ? "Saving…" : "Set password and continue"}
      </Button>
    </form>
  );
}
