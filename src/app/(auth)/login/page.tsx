import Link from "next/link";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/auth/session";
import { afterLogin, safeNextPath } from "@/lib/auth/next-path";
import { LoginForm } from "./login-form";
import { AuthFooter, AuthHeading } from "../fields";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error, next } = (await searchParams) as { error?: string; next?: string };
  if (await getOptionalUser()) redirect(afterLogin(next));

  return (
    <div>
      <AuthHeading title="Sign in" sub="Welcome back. Your day is waiting." />
      {error === "auth" ? (
        <p className="text-destructive mb-4 text-sm">That link expired or was opened in another browser. Sign in again.</p>
      ) : null}
      <LoginForm next={safeNextPath(next)} />
      <AuthFooter>
        No account?{" "}
        <Link href="/signup" className="text-foreground hover:underline">
          Request access
        </Link>
      </AuthFooter>
    </div>
  );
}
