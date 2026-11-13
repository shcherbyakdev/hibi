import Link from "next/link";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/auth/session";
import { afterLogin, safeNextPath } from "@/lib/auth/next-path";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error, next } = (await searchParams) as { error?: string; next?: string };
  if (await getOptionalUser()) redirect(afterLogin(next));

  return (
    <div>
      <h1 className="mb-6 text-center text-[22px] font-normal tracking-[-0.03em]">Sign in</h1>
      {error === "auth" ? (
        <p className="text-destructive mb-4 text-center text-sm">That link expired or was opened in another browser. Sign in again.</p>
      ) : null}
      <LoginForm next={safeNextPath(next)} />
      <p className="text-muted-foreground mt-7 text-center text-sm">
        No account?{" "}
        <Link href="/signup" className="text-foreground hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
