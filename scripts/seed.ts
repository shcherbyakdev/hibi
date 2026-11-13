/**
 * Demo account + a little data for local development. Idempotent: reruns
 * reuse the user and replace its rows. Run: npm run db:seed (db:reset runs it).
 */
import { loadEnvFile } from "node:process";
import { createClient } from "@supabase/supabase-js";
import { generateNKeysBetween } from "fractional-indexing";
import { hostnameOf, isLoopbackHost } from "./lib/host-guard";

try {
  loadEnvFile(".env.local");
} catch {}

const EMAIL = "demo@todo.local";
const PASSWORD = "Password123!";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — run `npm run setup`.");
// A fixed, public demo password must never land on a remote project.
if (!isLoopbackHost(hostnameOf(url) ?? "") && process.env.ALLOW_REMOTE_SEED !== "1") {
  throw new Error(`refusing to seed non-local host ${hostnameOf(url)} (set ALLOW_REMOTE_SEED=1 if deliberate)`);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

// Local calendar date. Not toISOString(): that is UTC, a day early east of GMT.
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = new Date();
const addDays = (n: number) => iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + n));
// Monday of this week; 1st of this month.
const weekStart = addDays(-((today.getDay() + 6) % 7));
const monthStart = iso(new Date(today.getFullYear(), today.getMonth(), 1));

async function demoUserId(): Promise<string> {
  const created = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
  if (!created.error) return created.data.user.id;
  // Already exists: find it. A local stack has a handful of users at most.
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const user = data.users.find((u) => u.email === EMAIL);
  if (!user) throw created.error;
  return user.id;
}

async function main() {
  const userId = await demoUserId();
  // Boards cascade to columns; items go explicitly (their board FK is set null).
  for (const table of ["items", "boards"] as const) {
    const { error } = await admin.from(table).delete().eq("user_id", userId);
    if (error) throw error;
  }

  const boardId = crypto.randomUUID();
  const colKeys = generateNKeysBetween(null, null, 3);
  const cols = ["Backlog", "Doing", "Done"].map((name, i) => ({
    id: crypto.randomUUID(), user_id: userId, board_id: boardId, name, sort_key: colKeys[i],
  }));
  const must = <T>(r: { error: unknown; data?: T }) => {
    if (r.error) throw r.error;
  };
  must(await admin.from("boards").insert({ id: boardId, user_id: userId, name: "Side project", layout: "kanban", sort_key: "a0" }));
  must(await admin.from("board_columns").insert(cols));

  const items: Array<Record<string, unknown>> = [
    { title: "Morning run", plan_scope: "day", plan_date: addDays(0), priority: 3 },
    { title: "Reply to emails", plan_scope: "day", plan_date: addDays(0) },
    { title: "Pay rent", plan_scope: "day", plan_date: addDays(-1), priority: 1 },
    { title: "Read 30 pages", plan_scope: "day", plan_date: addDays(0), status: "done", done_at: new Date().toISOString() },
    { title: "Groceries", plan_scope: "day", plan_date: addDays(1) },
    { title: "Plan the trip", plan_scope: "week", plan_date: weekStart, priority: 2 },
    { title: "Finish online course module", plan_scope: "month", plan_date: monthStart },
    { title: "Sketch landing page", board_id: boardId, column_id: cols[1].id },
    { title: "Set up analytics", board_id: boardId, column_id: cols[0].id },
    { title: "Buy a domain", board_id: boardId, column_id: cols[2].id, status: "done", done_at: new Date().toISOString() },
    { title: "Someday: learn piano" },
  ];
  const keys = generateNKeysBetween(null, null, items.length);
  must(await admin.from("items").insert(items.map((it, i) => ({ user_id: userId, sort_key: keys[i], ...it })), {
    // Rows have different keys; let a missing key take the column default.
    defaultToNull: false,
  }));

  console.log(`  ✓ seeded ${EMAIL} / ${PASSWORD} — 1 board, ${cols.length} columns, ${items.length} items`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
