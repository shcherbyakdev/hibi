"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { afterLogin } from "@/lib/auth/next-path";
import { env } from "@/env";
import { emailSchema, signInSchema, signUpSchema, type AuthState } from "./schema";

const confirmUrl = () => `${env.NEXT_PUBLIC_APP_URL}/auth/confirm`;

export async function sendMagicLink(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Enter a valid email." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: confirmUrl() },
  });
  if (error) return { error: "Couldn't send the link. Try again." };
  return { sent: true };
}

export async function signInWithPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter your email and password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  // Generic on purpose: don't reveal whether the account exists.
  if (error) return { error: "Wrong email or password." };
  redirect(afterLogin(formData.get("next")));
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ ...parsed.data, options: { emailRedirectTo: confirmUrl() } });
  if (error) {
    if (error.code === "weak_password") return { error: "That password is too weak." };
    if (error.code?.startsWith("over_")) return { error: "Too many attempts. Wait a minute." };
    return { error: "Couldn't create the account. Try again." };
  }
  // Existing emails get an obfuscated user (no error), so this reveals nothing.
  return { sent: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  // This session only: signing out here must not sign out your other devices
  // (supabase-js defaults to "global").
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
