import { loadEnvFile } from "node:process";

try {
  loadEnvFile(".env.local");
} catch {
  // Exported env (CI) is fine.
}

// These tests create users and write rows. Shell env wins over .env.local, so
// a shell with production vars loaded would aim them at production: refuse.
const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid").hostname;
if (!["127.0.0.1", "localhost"].includes(host)) {
  throw new Error(`Integration tests run against local Supabase only; NEXT_PUBLIC_SUPABASE_URL points at ${host}.`);
}
