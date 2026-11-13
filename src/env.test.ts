import { describe, expect, it } from "vitest";
import { envSchema } from "./env-schema";

// What CI's build job supplies (.github/workflows/ci.yml): no APP_ENV.
const CI_BUILD_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54411",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "ci-placeholder-anon-key",
  NEXT_PUBLIC_APP_URL: "http://localhost:3100",
};

const PROD = {
  APP_ENV: "production",
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnop.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  NEXT_PUBLIC_APP_URL: "https://hibi.vercel.app",
};

const issues = (input: object) => {
  const r = envSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

describe("envSchema", () => {
  it("accepts local and CI values (no APP_ENV)", () => {
    expect(issues(CI_BUILD_ENV)).toEqual([]);
  });

  it("accepts a complete production config", () => {
    expect(issues(PROD)).toEqual([]);
  });

  it("refuses production without an explicit, public, https app URL", () => {
    // Missing → would default to localhost: every email link would point there.
    const noUrl: Partial<typeof PROD> = { ...PROD };
    delete noUrl.NEXT_PUBLIC_APP_URL;
    expect(issues(noUrl)).toContain("NEXT_PUBLIC_APP_URL");
    expect(issues({ ...PROD, NEXT_PUBLIC_APP_URL: "http://localhost:3100" })).toContain("NEXT_PUBLIC_APP_URL");
    expect(issues({ ...PROD, NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100" })).toContain("NEXT_PUBLIC_APP_URL");
    expect(issues({ ...PROD, NEXT_PUBLIC_APP_URL: "http://hibi.app" })).toContain("NEXT_PUBLIC_APP_URL");
  });

  it("refuses production pointed at a local Supabase", () => {
    expect(issues({ ...PROD, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54411" })).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });
});
