// Post-login destinations. Pure and env-free so the proxy and the auth
// actions share one rule.
//
// A `next` is accepted only as a same-site PATH: exactly one leading "/"
// (so "//evil.com" and "/\evil.com" are out), no whitespace or control
// characters, never an auth page (a redirect loop).
const NEXT_RE = /^\/(?![\/\\])[^\s\x00-\x1f\x7f]*$/;
const AUTH_PAGES = ["/login", "/signup", "/auth/"];

export const DEFAULT_AFTER_LOGIN = "/plan/day";

export function safeNextPath(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 512 || !NEXT_RE.test(raw)) return null;
  if (AUTH_PAGES.some((p) => raw === p.replace(/\/$/, "") || raw.startsWith(p))) return null;
  return raw;
}

export function afterLogin(raw: unknown): string {
  return safeNextPath(raw) ?? DEFAULT_AFTER_LOGIN;
}

// Everything is private except the auth pages and their callback.
const PUBLIC = ["/login", "/signup"];

export function isProtectedPath(pathname: string): boolean {
  return !(PUBLIC.includes(pathname) || pathname.startsWith("/auth/"));
}
