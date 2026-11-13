"use client";

import { useActionState, useState } from "react";
import { sendMagicLink, signInWithPassword } from "@/features/auth/actions";
import type { AuthState } from "@/features/auth/schema";
import { Button } from "@/components/ui/button";
import { EmailField, FormError, PasswordField } from "../fields";

const initial: AuthState = {};

export function LoginForm({ next }: { next: string | null }) {
  const [magic, setMagic] = useState(false);
  const [state, action, pending] = useActionState(magic ? sendMagicLink : signInWithPassword, initial);

  if (state.sent) return <p className="text-sm">Check your email for a sign-in link.</p>;

  return (
    <form action={action} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <EmailField />
      {magic ? null : <PasswordField />}
      <FormError error={state.error} />
      <Button type="submit" disabled={pending} className="h-11">
        {magic ? (pending ? "Sending…" : "Email me a link") : pending ? "Signing in…" : "Sign in"}
      </Button>
      <Button type="button" variant="outline" onClick={() => setMagic(!magic)} className="h-11">
        {magic ? "Use password" : "Email me a link instead"}
      </Button>
    </form>
  );
}
