import Link from "next/link";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/auth/session";
import { DEFAULT_AFTER_LOGIN } from "@/lib/auth/next-path";
import { SignupForm } from "./signup-form";
import { AuthFooter, AuthHeading } from "../fields";

export default async function SignupPage() {
  if (await getOptionalUser()) redirect(DEFAULT_AFTER_LOGIN);
  return (
    <div>
      <AuthHeading title="Request access" sub="hibi is invite-only for now. Leave your email and you'll hear back." />
      <SignupForm />
      <AuthFooter>
        Have an account?{" "}
        <Link href="/login" className="text-foreground hover:underline">
          Sign in
        </Link>
      </AuthFooter>
    </div>
  );
}
