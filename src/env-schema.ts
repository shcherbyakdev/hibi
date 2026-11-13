import { z } from "zod";

// NEXT_PUBLIC_* vars are referenced literally in env.ts so Next can inline them.
export const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3100"),
  DATABASE_URL: z.url().optional(),
});
