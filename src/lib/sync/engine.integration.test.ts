import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createUser, signIn, waitFor, type TestUser } from "@/test/supabase";
import { LocalDb } from "./db";
import { createSyncEngine, type Rejection, type SyncEngine } from "./engine";
import { createMutations, type Mutations } from "./mutate";
import { toISODate } from "@/features/planner/periods";
import { ensureToday, routineFromTask } from "@/features/routines/generate";
import { occurrenceId } from "@/features/routines/model";

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
  goal_id: null, routine_id: null, sort_key: "a0", done_at: null,
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
    await a.m.insert("goals", { id: goalId, name: "Learn Japanese", notes: "", icon: null, weekly_target: 5, layout: "list" as const, sort_key: "a0" });
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
    const goalId = await a.m.insert("goals", { name: "Late goal", notes: "", icon: null, weekly_target: 5, layout: "list" as const, sort_key: "a0" });
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

  describe("routines", () => {
    const today = toISODate(new Date());
    const newRoutine = (title: string) => ({ title, priority: 0, goal_id: null, days: 127 });
    const copiesOf = async (d: Device, routineId: string) => (await d.db.items.where("routine_id").equals(routineId).toArray()).filter((i) => i.plan_date === today);

    it("makes today's copy once per device", async () => {
      const r = await a.m.insert("routines", newRoutine("Once"));
      expect(await ensureToday(a.db, a.m, today)).toBeGreaterThanOrEqual(1);
      expect(await ensureToday(a.db, a.m, today)).toBe(0);
      expect((await copiesOf(a, r)).length).toBe(1);
    });

    it("makes one server row when two offline devices both make it", async () => {
      const r = await a.m.insert("routines", newRoutine("Both"));
      await waitFor(async () => (await b.db.routines.get(r)) !== undefined);
      a.online = false;
      b.online = false;
      await ensureToday(a.db, a.m, today);
      await ensureToday(b.db, b.m, today);
      a.online = b.online = true;
      a.engine.sync();
      b.engine.sync();
      await waitFor(async () => (await a.db.outbox.count()) === 0 && (await b.db.outbox.count()) === 0);
      const { data } = await a.client.from("items").select("id").eq("routine_id", r).eq("plan_date", today);
      expect(data).toEqual([{ id: await occurrenceId(r, today) }]);
    });

    it("never undoes a tick when a lagging device makes the copy later", async () => {
      const r = await a.m.insert("routines", newRoutine("Tick"));
      await waitFor(async () => (await b.db.routines.get(r)) !== undefined);
      b.online = false;
      await ensureToday(a.db, a.m, today);
      const id = await occurrenceId(r, today);
      await a.m.update("items", id, { status: "done", done_at: new Date().toISOString() });
      await waitFor(async () => (await a.db.outbox.count()) === 0);

      expect(await ensureToday(b.db, b.m, today)).toBeGreaterThanOrEqual(1); // B never saw A's copy
      b.online = true;
      b.engine.sync();
      await waitFor(async () => (await b.db.items.get(id))?.status === "done");
      const { data } = await a.client.from("items").select("status").eq("id", id).single();
      expect(data?.status).toBe("done");
      expect(b.rejected).toEqual([]);
    });

    it("turns an unplanned task into today's copy instead of adding a second one", async () => {
      const id = await a.m.insert("items", newItem("From the inbox"));
      const r = await routineFromTask(a.db, a.m, (await a.db.items.get(id))!, today);
      expect(await ensureToday(a.db, a.m, today)).toBe(0);
      const copies = await copiesOf(a, r);
      expect(copies.map((c) => c.id)).toEqual([id]);
      expect(copies[0]).toMatchObject({ plan_scope: "day", plan_date: today, routine_id: r });
    });

    it("leaves a skipped (deleted) copy or a converted task alone", async () => {
      const r1 = await a.m.insert("routines", newRoutine("Skipped"));
      await ensureToday(a.db, a.m, today);
      await a.m.remove("items", await occurrenceId(r1, today));
      const r2 = await a.m.insert("routines", newRoutine("Converted"));
      await a.m.insert("items", { ...newItem("Converted"), plan_scope: "day", plan_date: today, routine_id: r2 });
      expect(await ensureToday(a.db, a.m, today)).toBe(0);
      expect((await copiesOf(a, r1)).length).toBe(1);
      expect((await copiesOf(a, r2)).length).toBe(1);
    });
  });

  it("upgrades a device whose local rows still carry board fields", async () => {
    // A device last opened before boards were folded into goals (Dexie v5).
    const name = `test-legacy-${user.id}`;
    const legacy = new Dexie(name);
    legacy.version(5).stores({
      boards: "id", board_columns: "id, board_id", outbox: "++seq", meta: "key", time_entries: "id, item_id", goals: "id", routines: "id",
      items: "id, [plan_scope+plan_date], board_id, status, goal_id, routine_id",
    });
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await legacy.table("items").put({
      ...newItem("Old device task"), id, user_id: user.id, board_id: crypto.randomUUID(), column_id: crypto.randomUUID(),
      created_at: now, updated_at: now, synced_at: "1970-01-01T00:00:00.000Z", deleted_at: null,
    });
    await legacy.table("outbox").bulkAdd([{ table: "boards", id: "gone" }, { table: "items", id }]);
    legacy.close();

    const dev = await device("legacy");
    await waitFor(async () => (await dev.db.outbox.count()) === 0 && dev.engine.getPhase() === "idle");
    expect(dev.rejected.map((r) => r.error.code + " " + r.error.message)).toEqual([]);
    expect(Object.keys((await dev.db.items.get(id))!)).not.toContain("board_id");
    expect(dev.rejected).toEqual([]);
    const { data } = await dev.client.from("items").select("title").eq("id", id).single();
    expect(data?.title).toBe("Old device task");
    dev.engine.stop();
  });
});
