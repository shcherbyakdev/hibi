"use client";

import { useActionState } from "react";
import { requestAccess } from "@/features/auth/actions";
import type { AuthState } from "@/features/auth/schema";
import { Button } from "@/components/ui/button";
import { EmailField, FormError } from "../fields";

const initial: AuthState = {};

export function SignupForm() {
  const [state, action, pending] = useActionState(requestAccess, initial);
  if (state.sent) return <p className="text-sm">Thanks — you&apos;ll get an email when your account is ready.</p>;
  return (
    <form action={action} className="flex flex-col gap-4">
      <EmailField />
      {/* Honeypot: hidden from people, filled by naive bots. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <FormError error={state.error} />
      <Button type="submit" disabled={pending} className="h-11">
        {pending ? "Sending…" : "Request access"}
      </Button>
    </form>
  );
}
