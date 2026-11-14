import { describe, it, expect } from "vitest";
import { afterLogin, isProtectedPath, safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it("accepts same-site paths with a query", () => {
    expect(safeNextPath("/week")).toBe("/week");
    expect(safeNextPath("/today?d=2026-11-13")).toBe("/today?d=2026-11-13");
  });
  it("rejects anything a browser could read as another origin", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "/x\nX-Injected: 1", "", 42, null]) {
      expect(safeNextPath(bad), String(bad)).toBeNull();
    }
  });
  it("never loops back into the auth pages", () => {
    expect(safeNextPath("/login")).toBeNull();
    expect(safeNextPath("/login?next=/x")).toBeNull();
    expect(safeNextPath("/auth/confirm?x=1")).toBeNull();
  });
  it("afterLogin falls back to the day plan", () => {
    expect(afterLogin("//evil.com")).toBe("/plan/day");
    expect(afterLogin("/month")).toBe("/month");
  });
});

describe("isProtectedPath", () => {
  it("protects the app", () => {
    for (const p of ["/", "/plan/week", "/goals/abc", "/settings"]) expect(isProtectedPath(p), p).toBe(true);
  });
  it("leaves auth surfaces public", () => {
    for (const p of ["/login", "/signup", "/invite", "/auth/confirm"]) expect(isProtectedPath(p), p).toBe(false);
  });
  it("does not treat lookalike prefixes as public", () => {
    expect(isProtectedPath("/loginx")).toBe(true);
  });
});
