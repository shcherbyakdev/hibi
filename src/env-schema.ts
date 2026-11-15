import { z } from "@/lib/zod";

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/;
const isLocal = (url: string) => LOCAL.test(new URL(url).hostname);

// NEXT_PUBLIC_* vars are referenced literally in env.ts so Next can inline them.
export const envSchema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    // No default: a silent localhost fallback would put localhost links in
    // every sign-in email. Locally, .env.local (npm run setup) provides it.
    NEXT_PUBLIC_APP_URL: z.url().optional(),
    // Production marker, set only on Vercel. NOT NODE_ENV: that is
    // "production" inside every `next build`, CI's placeholder build included.
    APP_ENV: z.enum(["development", "production"]).optional(),
    DATABASE_URL: z.url().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.APP_ENV !== "production") return;
    // Fail the deploy closed instead of shipping broken email links.
    const url = env.NEXT_PUBLIC_APP_URL;
    if (!url || isLocal(url) || !url.startsWith("https://")) {
      ctx.addIssue({ code: "custom", path: ["NEXT_PUBLIC_APP_URL"], message: "NEXT_PUBLIC_APP_URL must be the public https URL when APP_ENV=production" });
    }
    if (isLocal(env.NEXT_PUBLIC_SUPABASE_URL)) {
      ctx.addIssue({ code: "custom", path: ["NEXT_PUBLIC_SUPABASE_URL"], message: "NEXT_PUBLIC_SUPABASE_URL points at a local Supabase while APP_ENV=production" });
    }
  })
  // Outside production a missing app URL means local dev on the pinned port.
  .transform((env) => ({ ...env, NEXT_PUBLIC_APP_URL: env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100" }));
