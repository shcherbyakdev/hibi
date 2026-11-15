import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { waitFor } from "@/test/supabase";
import { LocalDb } from "./db";
import { createSyncEngine, type Rejection, type SyncEngine } from "./engine";
import { createMemoryServer } from "./memory-transport";
import { createMutations } from "./mutate";

// The engine's own logic against the in-memory server: no network, no
// Postgres. The same engine runs on Supabase in engine.integration.test.ts.
const USER = "00000000-0000-4000-8000-000000000001";
const newItem = (title: string) => ({
  title, notes: "", status: "todo" as const, priority: 0, plan_scope: null, plan_date: null,
  goal_id: null, routine_id: null, sort_key: "a0", done_at: null,
});

let engines: SyncEngine[] = [];
afterEach(() => {
  engines.forEach((e) => e.stop());
  engines = [];
});

function setup() {
  const server = createMemoryServer({
    refuse: (table, row) => (table === "items" && !row.title ? { code: "23514", message: "items_title_len" } : null),
  });
  const db = new LocalDb(`unit-${crypto.randomUUID()}`);
  const rejected: Rejection[] = [];
  const engine = createSyncEngine({ db, transport: server.transport(), onReject: (r) => rejected.push(r) });
  engines.push(engine);
  return { server, db, engine, rejected, m: createMutations(db, USER, engine.kick) };
}

describe("sync engine (memory transport)", () => {
  it("pushes offline writes on reconnect", async () => {
    const { server, db, engine, m } = setup();
    server.failNext("upsert");
    const id = await m.insert("items", newItem("On the train"));
    await waitFor(() => engine.getPhase() === "offline");
    expect(server.rows("items")).toEqual([]);
    engine.sync();
    await waitFor(async () => engine.getPhase() === "idle" && (await db.outbox.count()) === 0);
    expect(server.rows("items").map((r) => r.id)).toEqual([id]);
  });

  it("rejects only the bad row", async () => {
    const { server, db, engine, rejected } = setup();
    // Queue both before the engine runs, so they go up as one batch.
    const quiet = createMutations(db, USER, () => {});
    const good = await quiet.insert("items", newItem("Fine"));
    const bad = await quiet.insert("items", newItem(""));
    engine.sync();
    await waitFor(async () => engine.getPhase() === "idle" && (await db.outbox.count()) === 0);
    expect(server.rows("items").map((r) => r.id)).toEqual([good]);
    expect(await db.items.get(bad)).toBeUndefined();
    expect(rejected.map((r) => [r.id, r.error.code])).toEqual([[bad, "23514"]]);
  });

  it("keeps the local row when the rejection read fails", async () => {
    const { server, db, engine, rejected } = setup();
    const quiet = createMutations(db, USER, () => {});
    const bad = await quiet.insert("items", newItem(""));
    server.failNext("get");
    engine.sync();
    await waitFor(() => engine.getPhase() === "offline");
    expect(await db.items.get(bad)).toBeDefined(); // couldn't ask: never delete
    engine.sync();
    await waitFor(async () => engine.getPhase() === "idle" && (await db.outbox.count()) === 0);
    expect(await db.items.get(bad)).toBeUndefined();
    expect(rejected).toHaveLength(1);
  });

  it("pulls another client's write", async () => {
    const { server, db, engine } = setup();
    engine.start();
    const other = server.transport();
    const now = new Date().toISOString();
    await other.upsert("items", [{ ...newItem("From the phone"), id: crypto.randomUUID(), user_id: USER, created_at: now, updated_at: now, synced_at: now, deleted_at: null }]);
    await waitFor(async () => (await db.items.toArray()).some((i) => i.title === "From the phone"));
  });
});
