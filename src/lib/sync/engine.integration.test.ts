import "fake-indexeddb/auto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createUser, signIn, waitFor, type TestUser } from "@/test/supabase";
import { LocalDb } from "./db";
import { createSyncEngine, type Rejection, type SyncEngine } from "./engine";
import { createMutations, type Mutations } from "./mutate";

// Two "devices" of one user: separate IndexedDB, separate session, separate
// engine. Device A's network can be cut. Runs against the local stack.
type Device = { db: LocalDb; client: SupabaseClient; engine: SyncEngine; m: Mutations; rejected: Rejection[]; online: boolean };

let user: TestUser;
let a: Device;
let b: Device;

async function device(name: string): Promise<Device> {
  const dev = { online: true, rejected: [] as Rejection[] } as Device;
  const fetchImpl: typeof fetch = (input, init) =>
    dev.online ? fetch(input, init) : Promise.reject(new TypeError("Failed to fetch"));
  dev.client = await signIn(user, fetchImpl);
  dev.db = new LocalDb(`test-${name}-${user.id}`);
  dev.engine = createSyncEngine({ db: dev.db, supabase: dev.client, userId: user.id, onReject: (r) => dev.rejected.push(r) });
  dev.m = createMutations(dev.db, user.id, dev.engine.kick);
  dev.engine.start();
  return dev;
}

const newItem = (title: string) => ({
  title, notes: "", status: "todo" as const, priority: 0, plan_scope: null, plan_date: null,
  board_id: null, column_id: null, goal_id: null, sort_key: "a0", done_at: null,
});

beforeAll(async () => {
  user = await createUser();
  [a, b] = await Promise.all([device("a"), device("b")]);
  await waitFor(() => a.engine.getPhase() === "idle" && b.engine.getPhase() === "idle");
});

afterAll(() => {
  a.engine.stop();
  b.engine.stop();
});

describe("sync engine", () => {
  it("queues writes while offline and pushes them on reconnect", async () => {
    a.online = false;
    const id = await a.m.insert("items", newItem("Written on the train"));

    // Local read is immediate, regardless of network.
    expect((await a.db.items.get(id))?.title).toBe("Written on the train");
    await waitFor(() => a.engine.getPhase() === "offline");
    expect(await a.db.outbox.count()).toBe(1);
    const { data: before } = await b.client.from("items").select("id").eq("id", id);
    expect(before).toEqual([]);

    a.online = true;
    a.engine.sync();
    await waitFor(async () => (await a.db.outbox.count()) === 0 && a.engine.getPhase() === "idle");
    const { data: after } = await b.client.from("items").select("title").eq("id", id).single();
    expect(after?.title).toBe("Written on the train");
  });

  it("pushes a goal before the offline task that links to it", async () => {
    a.online = false;
    // Item first on purpose: push order, not write order, must satisfy the FK.
    const goalId = crypto.randomUUID();
    const itemId = await a.m.insert("items", { ...newItem("Anki 20 cards"), goal_id: goalId });
    await a.m.insert("goals", { id: goalId, name: "Learn Japanese", notes: "", icon: null, weekly_target: 5, sort_key: "a0" });
    a.online = true;
    a.engine.sync();
    await waitFor(async () => (await b.db.items.get(itemId))?.goal_id === goalId);
    expect((await b.db.goals.get(goalId))?.name).toBe("Learn Japanese");
    expect(a.rejected).toEqual([]);
  });

  it("keeps parents before children even when the outbox spans pages", async () => {
    a.online = false;
    const itemId = await a.m.insert("items", newItem("Long offline stretch"));
    // More queued writes than one push page (500) between the child and its parent.
    for (let i = 0; i < 510; i++) await a.m.update("items", itemId, { notes: `edit ${i}` });
    const goalId = await a.m.insert("goals", { name: "Late goal", notes: "", icon: null, weekly_target: 5, sort_key: "a0" });
    await a.m.update("items", itemId, { goal_id: goalId });
    a.online = true;
    a.engine.sync();
    await waitFor(async () => (await a.db.outbox.count()) === 0 && a.engine.getPhase() === "idle", 20_000);
    expect(a.rejected.map((r) => r.error.code)).toEqual([]);
    expect((await a.db.items.get(itemId))?.goal_id).toBe(goalId);
    await waitFor(async () => (await b.db.items.get(itemId))?.goal_id === goalId);
  }, 30_000);

  it("delivers an edit from one device to the other via realtime", async () => {
    const id = await a.m.insert("items", newItem("Shared"));
    // B never asks: realtime tells it something changed, it pulls.
    await waitFor(async () => (await b.db.items.get(id))?.title === "Shared");

    await b.m.update("items", id, { title: "Edited on B", status: "done" });
    await waitFor(async () => (await a.db.items.get(id))?.title === "Edited on B");
    expect((await a.db.items.get(id))?.status).toBe("done");
  });

  it("keeps an unpushed local edit when an older server row arrives", async () => {
    const id = await a.m.insert("items", newItem("Base"));
    await waitFor(async () => (await b.db.items.get(id)) !== undefined);

    a.online = false;
    await b.m.update("items", id, { title: "B first" });
    await a.m.update("items", id, { title: "A later" }); // newer stamp, stuck offline
    await waitFor(async () => (await b.client.from("items").select("title").eq("id", id).single()).data?.title === "B first");

    a.online = true;
    a.engine.sync();
    // A's newer edit survives the pull and wins on the server; B converges.
    await waitFor(async () => (await b.db.items.get(id))?.title === "A later");
    expect((await a.db.items.get(id))?.title).toBe("A later");
  });

  it("soft-deletes across devices", async () => {
    const id = await a.m.insert("items", newItem("Delete me"));
    await waitFor(async () => (await b.db.items.get(id)) !== undefined);
    await a.m.remove("items", id);
    await waitFor(async () => (await b.db.items.get(id))?.deleted_at != null);
  });

  it("rejects a row the server refuses instead of blocking the queue", async () => {
    const bad = await a.m.insert("items", newItem("")); // violates items_title_len
    const good = await a.m.insert("items", newItem("Still syncs"));

    await waitFor(() => a.rejected.some((r) => r.id === bad));
    await waitFor(async () => (await a.db.outbox.count()) === 0);
    expect(a.rejected.find((r) => r.id === bad)?.error.code).toBe("23514");
    // Never existed on the server, so it's dropped locally too.
    expect(await a.db.items.get(bad)).toBeUndefined();
    await waitFor(async () => (await b.db.items.get(good))?.title === "Still syncs");
  });

  it("fills an empty device from scratch", async () => {
    const c = await device("c");
    await waitFor(() => c.engine.getPhase() === "idle");
    const count = await waitFor(async () => (await c.db.items.count()) || 0);
    expect(count).toBe(await a.db.items.count());
    c.engine.stop();
  });
});
