import "fake-indexeddb/auto";
import { afterEach, expect, it } from "vitest";
import { waitFor } from "@/test/supabase";
import { LocalDb } from "@/lib/sync/db";
import { createSyncEngine, type SyncEngine } from "@/lib/sync/engine";
import { createMemoryServer } from "@/lib/sync/memory-transport";
import { createMutations } from "@/lib/sync/mutate";
import { LOCAL_USER_ID } from "@/lib/edition";
import { mergeLocal } from "./merge";

const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const item = (title: string, goal_id: string | null = null) => ({
  title, notes: "", status: "todo" as const, priority: 0, plan_scope: null, plan_date: null,
  goal_id, routine_id: null, sort_key: "a0", done_at: null,
});

let engines: SyncEngine[] = [];
afterEach(() => {
  engines.forEach((e) => e.stop());
  engines = [];
});

/** A device: a local db synced with `server` as `userId`. */
function device(server: ReturnType<typeof createMemoryServer>, userId: string) {
  const db = new LocalDb(`merge-${crypto.randomUUID()}`);
  const engine = createSyncEngine({ db, transport: server.transport() });
  engines.push(engine);
  const settled = () => waitFor(async () => engine.getPhase() === "idle" && (await db.outbox.count()) === 0);
  return { db, engine, settled, m: createMutations(db, userId, engine.kick) };
}

it("signing in merges the Mac's rows into the account, once", async () => {
  // The Mac before sign-in: a goal and a task on it, in the built-in service.
  const mac = createMemoryServer();
  const local = device(mac, LOCAL_USER_ID);
  const goalId = await local.m.insert("goals", { name: "Run", notes: "", icon: null, weekly_target: 3, layout: "list", sort_key: "a0" } as never);
  const taskId = await local.m.insert("items", item("5k", goalId));
  await local.settled();

  // The account already has a task from the web.
  const cloud = createMemoryServer();
  const web = device(cloud, ACCOUNT);
  const webId = await web.m.insert("items", item("From the web"));
  await web.settled();

  // Sign in on the Mac: a fresh account db, merge, then sync.
  const signedIn = device(cloud, ACCOUNT);
  expect(await mergeLocal(signedIn.db, mac.transport(), ACCOUNT)).toBe(2);
  signedIn.engine.start();
  await signedIn.settled();

  expect(cloud.rows("items").map((r) => r.id).sort()).toEqual([taskId, webId].sort());
  expect(cloud.rows("goals").map((r) => r.id)).toEqual([goalId]);
  expect([...cloud.rows("items"), ...cloud.rows("goals")].every((r) => r.user_id === ACCOUNT)).toBe(true);
  await waitFor(async () => (await signedIn.db.items.count()) === 2);

  // Next launch: nothing new on the Mac, nothing queued.
  expect(await mergeLocal(signedIn.db, mac.transport(), ACCOUNT)).toBe(0);
});

it("a second sign-in never puts an old Mac copy over a newer account edit", async () => {
  const mac = createMemoryServer();
  const local = device(mac, LOCAL_USER_ID);
  const id = await local.m.insert("items", item("Draft"));
  await local.settled();

  const cloud = createMemoryServer();
  const first = device(cloud, ACCOUNT);
  await mergeLocal(first.db, mac.transport(), ACCOUNT);
  first.engine.start();
  await first.settled();
  await first.m.update("items", id, { title: "Edited on the web" });
  await first.settled();

  // Sign out deletes the account db; sign in again starts from nothing.
  const again = device(cloud, ACCOUNT);
  await mergeLocal(again.db, mac.transport(), ACCOUNT);
  again.engine.start();
  await again.settled();

  expect(cloud.rows("items").find((r) => r.id === id)?.title).toBe("Edited on the web");
  await waitFor(async () => (await again.db.items.get(id))?.title === "Edited on the web");
});
