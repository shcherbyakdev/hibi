import { z } from "zod";

export const emailSchema = z.object({ email: z.email() });

export const signInSchema = z.object({ email: z.email(), password: z.string().min(1) });
// Mirrors minimum_password_length = 8 in supabase/config.toml.
export const passwordSchema = z.object({ password: z.string().min(8, "Password needs at least 8 characters.") });
export const inviteSchema = passwordSchema.extend({
  token: z.string().min(1, "This invite link is incomplete. Open it from the email again."),
});

export type AuthState = { error?: string; sent?: boolean };
