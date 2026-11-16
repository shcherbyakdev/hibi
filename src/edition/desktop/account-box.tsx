"use client";

import Link from "next/link";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { ACCOUNTS, supabase } from "./account";

// This Mac only: other devices stay signed in. The auth listener
// (account.tsx) then swaps the app back to this Mac's own data.
const signOut = async () => void (await supabase().auth.signOut({ scope: "local" }));

/** The sidebar's account corner. Signing in is optional on the Mac. */
export function AccountBox({ email }: { email: string }) {
  if (!ACCOUNTS) return null;
  if (!email)
    return (
      <Link href="/settings" className="text-subtle hover:text-foreground px-2 text-xs outline-none focus-visible:underline">
        Sign in to sync
      </Link>
    );
  return (
    <>
      <div className="text-subtle truncate px-2 text-xs" title={email}>
        {email}
      </div>
      <SignOutButton signOut={signOut} />
    </>
  );
}
