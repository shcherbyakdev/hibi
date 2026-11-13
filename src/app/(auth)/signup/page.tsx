import Link from "next/link";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/auth/session";
import { DEFAULT_AFTER_LOGIN } from "@/lib/auth/next-path";
import { SignupForm } from "./signup-form";

export default async function SignupPage() {
  if (await getOptionalUser()) redirect(DEFAULT_AFTER_LOGIN);
  return (
    <div>
      <h1 className="mb-6 text-center text-lg font-semibold tracking-tight">Create your account</h1>
      <SignupForm />
      <p className="text-muted-foreground mt-7 text-center text-sm">
        Have an account?{" "}
        <Link href="/login" className="text-foreground hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
