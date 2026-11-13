import { z } from "zod";

export const emailSchema = z.object({ email: z.email() });

// Sign-in checks presence only; signup enforces the policy (mirrors
// minimum_password_length = 8 in supabase/config.toml).
export const signInSchema = z.object({ email: z.email(), password: z.string().min(1) });
export const signUpSchema = z.object({
  email: z.email("Enter a valid email."),
  password: z.string().min(8, "Password needs at least 8 characters."),
});

export type AuthState = { error?: string; sent?: boolean };
