"use client";

import { useActionState } from "react";
import { signUp } from "@/features/auth/actions";
import type { AuthState } from "@/features/auth/schema";
import { Button } from "@/components/ui/button";
import { EmailField, FormError, PasswordField } from "../fields";

const initial: AuthState = {};

export function SignupForm() {
  const [state, action, pending] = useActionState(signUp, initial);
  if (state.sent) return <p className="text-sm">Check your email to confirm your account.</p>;
  return (
    <form action={action} className="flex flex-col gap-4">
      <EmailField />
      <PasswordField isNew />
      <FormError error={state.error} />
      <Button type="submit" disabled={pending} className="h-11">
        {pending ? "Creating…" : "Create account"}
      </Button>
    </form>
  );
}
