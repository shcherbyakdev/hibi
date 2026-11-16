"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/shared/password-input";
import { ACCOUNTS, supabase, useAccount } from "./account";

/** Settings → Account. Password only: an emailed link would open in the
    browser, not in this window. Accounts are made on the site (sign-up is
    by invite), so there is no "create account" here. */
export function AccountSettings() {
  const user = useAccount();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!ACCOUNTS) return null;

  const signIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    // On success the auth listener (account.tsx) swaps the whole app over.
    const { error } = await supabase()
      .auth.signInWithPassword({ email: String(form.get("email")).trim(), password: String(form.get("password")) })
      .catch(() => ({ error: { status: 0 } }));
    setBusy(false);
    // Generic on purpose: don't reveal whether the account exists.
    if (error) setError(error.status === 400 ? "Wrong email or password." : "Couldn't reach hibi. Check your connection and try again.");
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[13px] font-semibold">Account</h2>
      {user ? (
        <p className="text-subtle text-xs">
          Signed in as <span className="text-foreground">{user.email}</span>. This Mac and hibi on the web show the same data. Sign out from the sidebar.
        </p>
      ) : (
        <form onSubmit={signIn} className="flex max-w-xs flex-col gap-3">
          <p className="text-subtle text-xs">Sign in to see the same data here and on the web. What&apos;s already on this Mac is added to your account.</p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput id="password" name="password" required autoComplete="current-password" />
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <Button type="submit" disabled={busy} className="self-start">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      )}
    </section>
  );
}
