"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { afterLogin } from "@/lib/auth/next-path";
import { env } from "@/env";
import { emailSchema, signInSchema, type AuthState } from "./schema";

const confirmUrl = () => `${env.NEXT_PUBLIC_APP_URL}/auth/confirm`;

export async function sendMagicLink(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Enter a valid email." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: confirmUrl(), shouldCreateUser: false },
  });
  // Sign-up is closed, so an unknown email fails with otp_disabled. Answer
  // "sent" anyway: the form must not reveal who has an account.
  if (error && error.code !== "otp_disabled") return { error: "Couldn't send the link. Try again." };
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

// Sign-up is closed: visitors leave an email, the owner creates accounts by
// hand. A repeat email and a filled honeypot both answer "sent", so the form
// reveals nothing about who already asked.
export async function requestAccess(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (formData.get("website")) return { sent: true };
  const parsed = emailSchema.safeParse({ email: String(formData.get("email") ?? "").trim().toLowerCase() });
  if (!parsed.success) return { error: "Enter a valid email." };
  const supabase = await createClient();
  const { error } = await supabase.from("access_requests").insert({ email: parsed.data.email });
  if (error && error.code !== "23505") return { error: "Couldn't send the request. Try again." };
  return { sent: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  // This session only: signing out here must not sign out your other devices
  // (supabase-js defaults to "global").
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
