import "fake-indexeddb/auto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startGoSync } from "@/test/go-sync";
import { TestEventSource } from "@/test/event-source";
import { waitFor } from "@/test/supabase";
import { LocalDb } from "./db";
import { createSyncEngine, type Rejection, type SyncEngine } from "./engine";
import { createHttpTransport } from "./http-transport";
import { createMutations, type Mutations } from "./mutate";
import { describeTransportContract } from "./transport.contract";
import type { SyncRow } from "./transport";

// The desktop's Go sync service, through the transport the desktop app uses.
let go: { url: string; stop: () => void };
beforeAll(async () => {
  go = await startGoSync();
}, 120_000);
afterAll(() => go?.stop());

const USER = "00000000-0000-4000-8000-000000000001";
const es = (f: typeof fetch) => (url: string) => new TestEventSource(url, f) as unknown as EventSource;
const transport = (f: typeof fetch = fetch) => createHttpTransport(go.url, { fetch: f, EventSource: es(f) });
const item = (over: Partial<SyncRow> = {}): SyncRow => {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), user_id: USER, title: "Task", sort_key: "a0", updated_at: now, synced_at: now, ...over };
};

describeTransportContract("http (desktop Go service)", async () => ({
  a: transport(),
  b: transport(),
  newItem: () => item(),
  refusedItem: () => item({ title: "" }),
  refusals: { extra: { user_id: USER } },
}));

describe("engine over the desktop service", () => {
  type Device = { db: LocalDb; engine: SyncEngine; m: Mutations; rejected: Rejection[]; online: boolean };
  const devices: Device[] = [];
  const device = (): Device => {
    const dev = { online: true, rejected: [] as Rejection[] } as Device;
    const f: typeof fetch = (input, init) => (dev.online ? fetch(input, init) : Promise.reject(new TypeError("Failed to fetch")));
    dev.db = new LocalDb(`http-${crypto.randomUUID()}`);
    dev.engine = createSyncEngine({ db: dev.db, transport: transport(f), onReject: (r) => dev.rejected.push(r) });
    dev.m = createMutations(dev.db, USER, dev.engine.kick);
    dev.engine.start();
    devices.push(dev);
    return dev;
  };
  afterAll(() => devices.forEach((d) => d.engine.stop()));
  const newItem = (title: string) => ({
    title, notes: "", status: "todo" as const, priority: 0, plan_scope: null, plan_date: null,
    goal_id: null, routine_id: null, sort_key: "a0", done_at: null,
  });

  it("syncs an offline write, a goal before its item, and moves past a refusal", async () => {
    const a = device();
    const b = device();
    a.online = false;
    const goalId = crypto.randomUUID();
    const itemId = await a.m.insert("items", { ...newItem("Anki"), goal_id: goalId }); // child first on purpose
    await a.m.insert("goals", { id: goalId, name: "Japanese", notes: "", icon: null, weekly_target: 5, layout: "list", sort_key: "a0" });
    const bad = await a.m.insert("items", newItem("")); // the service refuses an empty title
    await waitFor(() => a.engine.getPhase() === "offline");
    a.online = true;
    a.engine.sync();
    await waitFor(async () => (await a.db.outbox.count()) === 0 && a.engine.getPhase() === "idle", 20_000);
    expect(a.rejected.map((r) => [r.id, r.error.code])).toEqual([[bad, "23514"]]);
    expect(await a.db.items.get(bad)).toBeUndefined();
    // B hears the hint and pulls both, in FK order.
    await waitFor(async () => (await b.db.items.get(itemId))?.goal_id === goalId, 20_000);
    expect((await b.db.goals.get(goalId))?.name).toBe("Japanese");
  }, 60_000);
});
