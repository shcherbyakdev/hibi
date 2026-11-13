import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_AFTER_LOGIN } from "@/lib/auth/next-path";

// Email links land here: token_hash (custom templates) or ?code= (PKCE).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();
  let verified = false;
  try {
    if (token_hash && type) verified = !(await supabase.auth.verifyOtp({ type, token_hash })).error;
    else if (code) verified = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } catch (e) {
    console.error("[auth/confirm]", e);
  }

  // A used link reopened by someone already signed in is not an error.
  if (verified || (await supabase.auth.getUser()).data.user) {
    return NextResponse.redirect(new URL(DEFAULT_AFTER_LOGIN, request.url));
  }
  return NextResponse.redirect(new URL("/login?error=auth", request.url));
}
