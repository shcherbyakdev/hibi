import { z } from "zod";

export const emailSchema = z.object({ email: z.email() });

export const signInSchema = z.object({ email: z.email(), password: z.string().min(1) });

export type AuthState = { error?: string; sent?: boolean };
