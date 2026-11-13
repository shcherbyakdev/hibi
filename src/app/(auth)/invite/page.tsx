import Link from "next/link";
import { InviteForm } from "./invite-form";
import { AuthFooter, AuthHeading } from "../fields";

// Deliberately no "already signed in" redirect: opening an invite on a
// browser signed in as someone else must still let the invitee in.
export default async function InvitePage({ searchParams }: PageProps<"/invite">) {
  const { token_hash } = (await searchParams) as { token_hash?: string };
  return (
    <div>
      <AuthHeading title="Welcome to hibi" sub="Choose a password to finish setting up your account." />
      <InviteForm token={token_hash} />
      <AuthFooter>
        Already set up?{" "}
        <Link href="/login" className="text-foreground hover:underline">
          Sign in
        </Link>
      </AuthFooter>
    </div>
  );
}
