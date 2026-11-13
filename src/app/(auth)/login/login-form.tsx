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
      {magic ? (
        <p className="text-muted-foreground -mt-1 text-xs">No password needed — we&apos;ll email you a sign-in link.</p>
      ) : (
        <PasswordField
          aside={
            // A lost password is covered by the email link: one way in, no reset flow to maintain.
            <button type="button" onClick={() => setMagic(true)} className="text-muted-foreground hover:text-foreground text-xs outline-none focus-visible:underline">
              Forgot password?
            </button>
          }
        />
      )}
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
