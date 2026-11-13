import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/next-path";

// Always validate against the Auth server with getUser() — never getSession().
export async function getOptionalUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireUser(): Promise<User> {
  const user = await getOptionalUser();
  if (!user) {
    // The proxy stamps the request path so login can bring the user back.
    const back = safeNextPath((await headers()).get("x-pathname"));
    redirect(back ? `/login?next=${encodeURIComponent(back)}` : "/login");
  }
  return user;
}
