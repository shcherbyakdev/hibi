import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, anonClient, signedInUser } from "@/test/supabase";

// The database contract the sync layer relies on (0001_rls_sync.sql).
let a: { id: string; client: SupabaseClient };
let b: { id: string; client: SupabaseClient };

beforeAll(async () => {
  [a, b] = await Promise.all([signedInUser(), signedInUser()]);
});

const item = (over: Record<string, unknown> = {}) => ({
  id: randomUUID(),
  title: "Write the plan",
  sort_key: "a0",
  updated_at: new Date().toISOString(),
  ...over,
});

describe("ownership (RLS)", () => {
  it("defaults user_id to the caller and hides rows from everyone else", async () => {
    const row = item();
    const ins = await a.client.from("items").insert(row).select("user_id").single();
    expect(ins.error).toBeNull();
    expect(ins.data!.user_id).toBe(a.id);

    const seenByB = await b.client.from("items").select("id").eq("id", row.id);
    expect(seenByB.data).toEqual([]);
    const seenByAnon = await anonClient().from("items").select("id").eq("id", row.id);
    expect(seenByAnon.data ?? []).toEqual([]);
  });

  it("refuses writes on someone else's rows or in their name", async () => {
    const row = item();
    await a.client.from("items").insert(row);

    const upd = await b.client.from("items").update({ title: "hijacked" }).eq("id", row.id).select("id");
    expect(upd.data).toEqual([]);
    const del = await b.client.from("items").delete().eq("id", row.id).select("id");
    expect(del.data).toEqual([]);
    const forged = await b.client.from("items").insert(item({ user_id: a.id }));
    expect(forged.error?.code).toBe("42501");

    const still = await a.client.from("items").select("title").eq("id", row.id).single();
    expect(still.data!.title).toBe("Write the plan");
  });

});

describe("sync stamp", () => {
  it("sets synced_at on the server, ignoring the client's value", async () => {
    const row = item({ synced_at: "2000-01-01T00:00:00Z" });
    const ins = await a.client.from("items").insert(row).select("synced_at").single();
    expect(new Date(ins.data!.synced_at).getFullYear()).toBeGreaterThan(2000);
  });

  it("last write wins: an upsert with an older updated_at is dropped", async () => {
    const t0 = Date.now();
    const row = item({ updated_at: new Date(t0).toISOString() });
    await a.client.from("items").insert(row);

    const newer = { ...row, title: "newer", updated_at: new Date(t0 + 1000).toISOString() };
    expect((await a.client.from("items").upsert(newer)).error).toBeNull();
    const stale = { ...row, title: "stale", updated_at: new Date(t0 + 500).toISOString() };
    expect((await a.client.from("items").upsert(stale)).error).toBeNull();

    const got = await a.client.from("items").select("title").eq("id", row.id).single();
    expect(got.data!.title).toBe("newer");
  });

  it("lets the pull cursor find rows changed since a point in time", async () => {
    const before = (await a.client.from("items").insert(item()).select("synced_at").single()).data!.synced_at;
    const row = item();
    await a.client.from("items").insert(row);
    const changed = await a.client.from("items").select("id").gt("synced_at", before);
    expect(changed.data!.map((r) => r.id)).toContain(row.id);
  });
});

describe("time entries", () => {
  it("are owner-only and stamped like every synced table", async () => {
    const it_ = item();
    await a.client.from("items").insert(it_);
    const entry = { id: randomUUID(), item_id: it_.id, started_at: new Date().toISOString(), synced_at: "2000-01-01T00:00:00Z" };
    const ins = await a.client.from("time_entries").insert(entry).select("user_id, synced_at").single();
    expect(ins.error).toBeNull();
    expect(ins.data!.user_id).toBe(a.id);
    expect(new Date(ins.data!.synced_at).getFullYear()).toBeGreaterThan(2000);
    expect((await b.client.from("time_entries").select("id").eq("id", entry.id)).data).toEqual([]);
    expect((await b.client.from("time_entries").update({ ended_at: new Date().toISOString() }).eq("id", entry.id).select("id")).data).toEqual([]);
  });

  it("reject an end before the start and absurd pomodoro lengths", async () => {
    const it_ = item();
    await a.client.from("items").insert(it_);
    const base = { item_id: it_.id, started_at: "2026-11-13T10:00:00Z" };
    expect((await a.client.from("time_entries").insert({ ...base, ended_at: "2026-11-13T09:00:00Z" })).error?.code).toBe("23514");
    expect((await a.client.from("time_entries").insert({ ...base, planned_seconds: 10 })).error?.code).toBe("23514");
    expect((await a.client.from("time_entries").insert({ ...base, planned_seconds: 1500 })).error).toBeNull();
  });
});

describe("goals", () => {
  const goal = (over: Record<string, unknown> = {}) => ({ id: randomUUID(), name: "Learn Japanese", sort_key: "a0", ...over });

  it("are owner-only and can be linked from items", async () => {
    const g = goal();
    const ins = await a.client.from("goals").insert(g).select("user_id, weekly_target").single();
    expect(ins.error).toBeNull();
    expect(ins.data).toEqual({ user_id: a.id, weekly_target: 5 });
    expect((await b.client.from("goals").select("id").eq("id", g.id)).data).toEqual([]);
    expect((await b.client.from("goals").update({ name: "hijacked" }).eq("id", g.id).select("id")).data).toEqual([]);
    expect((await a.client.from("items").insert(item({ goal_id: g.id }))).error).toBeNull();
  });

  it("accept a list or board layout and nothing else", async () => {
    expect((await a.client.from("goals").insert(goal({ layout: "board" }))).error).toBeNull();
    expect((await a.client.from("goals").insert(goal({ layout: "kanban" }))).error?.code).toBe("23514");
  });

  it("reject weekly targets outside 1–7 and empty names", async () => {
    expect((await a.client.from("goals").insert(goal({ weekly_target: 0 }))).error?.code).toBe("23514");
    expect((await a.client.from("goals").insert(goal({ weekly_target: 8 }))).error?.code).toBe("23514");
    expect((await a.client.from("goals").insert(goal({ name: "" }))).error?.code).toBe("23514");
  });
});

describe("routines", () => {
  const routine = (over: Record<string, unknown> = {}) => ({ id: randomUUID(), title: "Stretch", ...over });

  it("are owner-only and can be linked from items", async () => {
    const r = routine();
    const ins = await a.client.from("routines").insert(r).select("user_id, days").single();
    expect(ins.error).toBeNull();
    expect(ins.data).toEqual({ user_id: a.id, days: 127 });
    expect((await b.client.from("routines").select("id").eq("id", r.id)).data).toEqual([]);
    expect((await b.client.from("routines").update({ title: "hijacked" }).eq("id", r.id).select("id")).data).toEqual([]);
    expect((await a.client.from("items").insert(item({ routine_id: r.id }))).error).toBeNull();
  });

  it("reject empty day masks, out-of-range masks and empty titles", async () => {
    expect((await a.client.from("routines").insert(routine({ days: 0 }))).error?.code).toBe("23514");
    expect((await a.client.from("routines").insert(routine({ days: 128 }))).error?.code).toBe("23514");
    expect((await a.client.from("routines").insert(routine({ title: "" }))).error?.code).toBe("23514");
  });
});

describe("constraints", () => {
  it("requires plan_scope and plan_date together", async () => {
    const res = await a.client.from("items").insert(item({ plan_scope: "day" }));
    expect(res.error?.code).toBe("23514");
  });

  it("pins month plans to the 1st", async () => {
    expect((await a.client.from("items").insert(item({ plan_scope: "month", plan_date: "2026-11-13" }))).error?.code).toBe("23514");
    expect((await a.client.from("items").insert(item({ plan_scope: "month", plan_date: "2026-11-01" }))).error).toBeNull();
  });

  it("rejects unknown statuses and empty titles", async () => {
    expect((await a.client.from("items").insert(item({ status: "maybe" }))).error?.code).toBe("23514");
    expect((await a.client.from("items").insert(item({ title: "" }))).error?.code).toBe("23514");
  });
});

describe("owner-scoped links (0013)", () => {
  // A hard delete (account deletion cascades, admin cleanup) must unlink the
  // tasks: SET NULL (goal_id) clears the link column only, never user_id.
  it("deleting a goal unlinks its tasks and routines", async () => {
    const goal = { id: randomUUID(), name: "Japanese", sort_key: "a0", updated_at: new Date().toISOString() };
    expect((await a.client.from("goals").insert(goal)).error).toBeNull();
    const task = item({ goal_id: goal.id });
    expect((await a.client.from("items").insert(task)).error).toBeNull();
    const routine = { id: randomUUID(), title: "Anki", goal_id: goal.id, updated_at: new Date().toISOString() };
    expect((await a.client.from("routines").insert(routine)).error).toBeNull();

    expect((await adminClient().from("goals").delete().eq("id", goal.id)).error).toBeNull();
    const after = await a.client.from("items").select("goal_id, user_id").eq("id", task.id).single();
    expect(after.data).toEqual({ goal_id: null, user_id: a.id });
    expect((await a.client.from("routines").select("goal_id").eq("id", routine.id).single()).data).toEqual({ goal_id: null });
  });
});
