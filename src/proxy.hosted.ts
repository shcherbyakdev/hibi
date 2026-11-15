import { type NextRequest } from "next/server";
import { env } from "@/env";
import { contentSecurityPolicy, newNonce } from "@/lib/csp";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 "proxy" convention (formerly "middleware"). Runs on every
// matched request: a fresh CSP nonce, then the Supabase session refresh.
export async function proxy(request: NextRequest) {
  const nonce = newNonce();
  const csp = contentSecurityPolicy(nonce, env.NEXT_PUBLIC_SUPABASE_URL, process.env.NODE_ENV === "development");
  // On the request: Next reads the nonce from this CSP while rendering, the
  // root layout from x-nonce. updateSession forwards request headers.
  request.headers.set("x-nonce", nonce);
  request.headers.set("content-security-policy", csp);
  const response = await updateSession(request);
  response.headers.set("content-security-policy", csp);
  return response;
}

// Named proxy.hosted.ts so only the hosted build has it (pageExtensions);
// under that name Next looks for a default export.
export default proxy;

export const config = {
  matcher: [
    // Run on all routes except static assets and image files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
