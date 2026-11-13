import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_AFTER_LOGIN } from "@/lib/auth/next-path";

// Email links (magic link, signup confirmation) land here with ?code= — the
// PKCE flow @supabase/ssr uses. The code only exchanges in the browser that
// asked for the link (its verifier cookie lives there), so a link someone
// else requested can't sign you into their account (login CSRF). There is
// deliberately no token_hash branch: that flow has no such binding.
// Cost: a link opened in a different browser doesn't sign in (the email is
// still confirmed; signing in with the password works).
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const supabase = await createClient();

  let verified = false;
  if (code) {
    try {
      verified = !(await supabase.auth.exchangeCodeForSession(code)).error;
    } catch (e) {
      console.error("[auth/confirm]", e);
    }
  }

  // A used link reopened by someone already signed in is not an error.
  if (verified || (await supabase.auth.getUser()).data.user) {
    return NextResponse.redirect(new URL(DEFAULT_AFTER_LOGIN, request.url));
  }
  return NextResponse.redirect(new URL("/login?error=auth", request.url));
}
