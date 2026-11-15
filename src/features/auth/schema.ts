import { z } from "zod";

export const emailSchema = z.object({ email: z.email() });

export const signInSchema = z.object({ email: z.email(), password: z.string().min(1) });
// Mirrors minimum_password_length = 12 in supabase/config.toml.
export const passwordSchema = z.object({ password: z.string().min(12, "Password needs at least 12 characters.") });
export const inviteSchema = passwordSchema.extend({
  token: z.string().min(1, "This invite link is incomplete. Open it from the email again."),
});

export type AuthState = { error?: string; sent?: boolean };
