import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, newNonce } from "./csp";

const directives = (csp: string) => Object.fromEntries(csp.split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1)]));

describe("contentSecurityPolicy", () => {
  const prod = directives(contentSecurityPolicy("abc", "https://x.supabase.co", false));

  it("only runs scripts carrying this request's nonce", () => {
    expect(prod["script-src"]).toEqual(["'self'", "'nonce-abc'", "'strict-dynamic'"]);
  });

  it("lets the app talk to Supabase over https and its realtime websocket, nothing else", () => {
    expect(prod["connect-src"]).toEqual(["'self'", "https://x.supabase.co", "wss://x.supabase.co"]);
  });

  it("locks down the rest", () => {
    expect(prod["object-src"]).toEqual(["'none'"]);
    expect(prod["base-uri"]).toEqual(["'self'"]);
    expect(prod["frame-ancestors"]).toEqual(["'none'"]);
    expect(prod["upgrade-insecure-requests"]).toEqual([]);
  });

  it("in dev allows eval (React's dev tooling) and local http Supabase, and doesn't upgrade it", () => {
    const dev = directives(contentSecurityPolicy("abc", "http://127.0.0.1:54411", true));
    expect(dev["script-src"]).toContain("'unsafe-eval'");
    expect(dev["connect-src"]).toEqual(["'self'", "http://127.0.0.1:54411", "ws://127.0.0.1:54411"]);
    expect(dev["upgrade-insecure-requests"]).toBeUndefined();
  });

  it("doesn't upgrade a local http Supabase in a production build either", () => {
    const localProd = directives(contentSecurityPolicy("abc", "http://127.0.0.1:54411", false));
    expect(localProd["script-src"]).not.toContain("'unsafe-eval'");
    expect(localProd["upgrade-insecure-requests"]).toBeUndefined();
  });

  it("makes a fresh nonce each time", () => {
    expect(newNonce()).not.toBe(newNonce());
    expect(newNonce()).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
});
