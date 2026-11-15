import { SignOutButton } from "@/components/shell/sign-out-button";

/** The sidebar's account corner: who's signed in, and sign out. */
export function AccountBox({ email }: { email: string }) {
  return (
    <>
      <div className="text-subtle truncate px-2 text-xs" title={email}>
        {email}
      </div>
      <SignOutButton />
    </>
  );
}
