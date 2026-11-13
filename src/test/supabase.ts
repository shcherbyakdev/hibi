import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

export const anonClient = () => createClient(url(), anonKey(), opts);
export const adminClient = () => createClient(url(), process.env.SUPABASE_SERVICE_ROLE_KEY!, opts);

export type TestUser = { id: string; email: string; password: string };

export async function createUser(): Promise<TestUser> {
  const email = `t-${randomUUID()}@todo.local`;
  const password = "Password123!";
  const { data, error } = await adminClient().auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  return { id: data.user.id, email, password };
}

/** A separate session for the user on its own anon-key client (RLS applies).
    `fetch` lets a test cut the network. */
export async function signIn(user: TestUser, fetchImpl: typeof fetch = fetch): Promise<SupabaseClient> {
  const client = createClient(url(), anonKey(), { ...opts, global: { fetch: fetchImpl } });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  return client;
}

export async function signedInUser(): Promise<{ id: string; client: SupabaseClient }> {
  const user = await createUser();
  return { id: user.id, client: await signIn(user) };
}

/** Polls until `fn` returns truthy (sync is asynchronous by design). */
export async function waitFor<T>(fn: () => Promise<T> | T, timeoutMs = 10_000): Promise<T> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, 50));
  }
}
