// The hosted site's Content-Security-Policy, built per request around a
// nonce (src/proxy.hosted.ts). Next attaches the nonce to its own scripts
// while rendering; next-themes gets it from the root layout. An injected
// <script> has no nonce, so it doesn't run: the line of defence that
// matters, since Supabase's session cookie is readable by page scripts.

export const newNonce = () => Buffer.from(crypto.randomUUID()).toString("base64");

export function contentSecurityPolicy(nonce: string, supabaseUrl: string, dev: boolean): string {
  const supabase = new URL(supabaseUrl);
  const realtime = `${supabase.protocol === "https:" ? "wss:" : "ws:"}//${supabase.host}`;
  return [
    "default-src 'self'",
    // 'unsafe-eval' in dev only: React rebuilds server error stacks with eval.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Styles stay inline-capable: Sonner and dnd-kit set them at runtime, and
    // injected CSS can't run code the way an injected script can.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self' ${supabase.origin} ${realtime}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Only with an https Supabase: against a local http:// one it would
    // upgrade those calls and break them.
    ...(supabase.protocol === "https:" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
