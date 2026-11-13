"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { afterLogin, DEFAULT_AFTER_LOGIN } from "@/lib/auth/next-path";
import { env } from "@/env";
import { emailSchema, inviteSchema, passwordSchema, signInSchema, type AuthState } from "./schema";

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

// The invite link only carries the token; nothing is spent on GET (mail
// scanners prefetch links). Verifying it together with the new password
// also means a forwarded link can't silently sign someone into another
// person's account.
export async function acceptInvite(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = inviteSchema.safeParse({ token: formData.get("token"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  const supabase = await createClient();
  const verified = await supabase.auth.verifyOtp({ token_hash: parsed.data.token, type: "invite" });
  if (verified.error) return { error: "This invite link has expired or was already used. Ask for a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    // Signed in by now, but without a password: they can set one with
    // "Forgot password?" on the next visit.
    console.error("[acceptInvite] password not saved:", error.code);
    return { error: error.code === "weak_password" ? "That password is too weak. Choose another." : "Couldn't save the password. Try again." };
  }
  redirect(DEFAULT_AFTER_LOGIN);
}

// Default-email invites arrive already signed in (the /invite page sets the
// session from the link), so here only the password is missing.
export async function setPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = passwordSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your password." };
  const supabase = await createClient();
  if (!(await supabase.auth.getUser()).data.user) return { error: "This invite link has expired or was already used. Ask for a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.code === "weak_password" ? "That password is too weak. Choose another." : "Couldn't save the password. Try again." };
  redirect(DEFAULT_AFTER_LOGIN);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  // This session only: signing out here must not sign out your other devices
  // (supabase-js defaults to "global").
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
