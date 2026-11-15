import { describe, expect, it } from "vitest";
import { waitFor } from "@/test/supabase";
import type { SyncRow, SyncTransport } from "./transport";
import type { SyncedTable } from "./db";

export type ContractSetup = () => Promise<{
  /** Two clients of one user's data. */
  a: SyncTransport;
  b: SyncTransport;
  /** A fresh valid item row (new id each call). */
  newItem: () => SyncRow;
  /** An item row the server must refuse (e.g. an empty title). */
  refusedItem: () => SyncRow;
  /** Opt in to the refusal fixture: servers that enforce the schema's
      checks and FKs (Supabase, the desktop service). `extra` is merged
      into every fixture row (e.g. user_id). `other` is a second owner's
      client, for links that must not cross owners. */
  refusals?: { extra: Record<string, unknown>; other: { transport: SyncTransport; extra: Record<string, unknown> } };
}>;

/** One rule per table plus the FKs, with the Postgres code every
    enforcing server must answer. A schema change touches Postgres,
    desktop/syncsvc/rules.go and this list (AGENTS.md). */
const REFUSALS: Array<{ name: string; table: SyncedTable; over: Record<string, unknown>; code: string; withItem?: boolean }> = [
  { name: "goal with an empty name", table: "goals", over: { name: "" }, code: "23514" },
  { name: "goal aiming for 9 days a week", table: "goals", over: { weekly_target: 9 }, code: "23514" },
  { name: "goal with an unknown layout", table: "goals", over: { layout: "kanban" }, code: "23514" },
  { name: "routine on no days", table: "routines", over: { days: 0 }, code: "23514" },
  { name: "routine with a missing goal", table: "routines", over: { goal_id: crypto.randomUUID() }, code: "23503" },
  { name: "item with an unknown status", table: "items", over: { status: "maybe" }, code: "23514" },
  { name: "item planned for a month mid-month", table: "items", over: { plan_scope: "month", plan_date: "2026-11-15" }, code: "23514" },
  { name: "item with a scope but no date", table: "items", over: { plan_scope: "day" }, code: "23514" },
  { name: "item with a missing goal", table: "items", over: { goal_id: crypto.randomUUID() }, code: "23503" },
  { name: "time entry with a missing item", table: "time_entries", over: { item_id: crypto.randomUUID() }, code: "23503" },
  { name: "time entry ending before it starts", table: "time_entries", over: { ended_at: "2026-11-15T09:00:00Z" }, code: "23514", withItem: true },
  { name: "time entry of 10 seconds planned", table: "time_entries", over: { planned_seconds: 10 }, code: "23514", withItem: true },
];

/** Links between rows stay within one owner: Postgres composite FKs
    (id, user_id), the same check in rules.go/store.go. */
const CROSS_OWNER: Array<{ name: string; child: SyncedTable; column: string; parent: SyncedTable }> = [
  { name: "item on another owner's goal", child: "items", column: "goal_id", parent: "goals" },
  { name: "item on another owner's routine", child: "items", column: "routine_id", parent: "routines" },
  { name: "routine on another owner's goal", child: "routines", column: "goal_id", parent: "goals" },
  { name: "time entry on another owner's item", child: "time_entries", column: "item_id", parent: "items" },
];

const VALID: Record<SyncedTable, Record<string, unknown>> = {
  goals: { name: "Goal", sort_key: "a0" },
  routines: { title: "Stretch" },
  items: { title: "Task", sort_key: "a0" },
  time_entries: { started_at: "2026-11-15T10:00:00Z" },
};

const later = (iso: string, ms: number) => new Date(Date.parse(iso) + ms).toISOString();

/** What any sync server must do, so the engine can't tell them apart. */
export function describeTransportContract(name: string, setup: ContractSetup) {
  describe(`sync transport contract: ${name}`, () => {
    it("stamps synced_at on the server", async () => {
      const { a, newItem } = await setup();
      const row = { ...newItem(), synced_at: "2000-01-01T00:00:00.000Z" };
      expect(await a.upsert("items", [row])).toBeNull();
      const got = await a.get("items", row.id);
      expect(Date.parse(got!.synced_at)).toBeGreaterThan(Date.parse("2001-01-01"));
    });

    it("drops older writes", async () => {
      const { a, newItem } = await setup();
      const row = newItem();
      await a.upsert("items", [row]);
      expect(await a.upsert("items", [{ ...row, title: "stale", updated_at: later(row.updated_at, -60_000) }])).toBeNull();
      expect((await a.get("items", row.id))!.title).toBe(row.title);
    });

    it("pulls since a cursor", async () => {
      const { a, newItem } = await setup();
      const before = newItem();
      await a.upsert("items", [before]);
      const cursor = (await a.get("items", before.id))!.synced_at;
      const after = newItem();
      await a.upsert("items", [after]);
      const ids = (await a.pull("items", { since: cursor }, 500)).map((r) => r.id);
      expect(ids).toContain(after.id);
      expect(ids).not.toContain(before.id);
    });

    it("pages a burst", async () => {
      const { a, newItem } = await setup();
      const first = newItem();
      await a.upsert("items", [first]);
      const cursor = (await a.get("items", first.id))!.synced_at;
      const burst = Array.from({ length: 5 }, newItem);
      await a.upsert("items", burst); // one batch: may share one synced_at
      const seen: SyncRow[] = [];
      let page = await a.pull("items", { since: cursor }, 2);
      for (;;) {
        seen.push(...page);
        if (page.length < 2) break;
        const last = page[page.length - 1];
        page = await a.pull("items", { after: { synced_at: last.synced_at, id: last.id } }, 2);
      }
      const mine = seen.filter((r) => burst.some((b) => b.id === r.id));
      expect(mine.map((r) => r.id).sort()).toEqual(burst.map((b) => b.id).sort());
      expect(new Set(seen.map((r) => r.id)).size).toBe(seen.length);
      const keys = seen.map((r) => `${r.synced_at}|${r.id}`);
      expect(keys).toEqual([...keys].sort());
    });

    it("refuses a bad row, all or nothing", async () => {
      const { a, newItem, refusedItem } = await setup();
      const good = newItem();
      const err = await a.upsert("items", [good, refusedItem()]);
      expect(err?.code).toBeTruthy();
      expect(await a.get("items", good.id)).toBeNull();
    });

    it("gets one row or null", async () => {
      const { a, newItem } = await setup();
      const row = newItem();
      await a.upsert("items", [row]);
      expect((await a.get("items", row.id))!.title).toBe(row.title);
      expect(await a.get("items", crypto.randomUUID())).toBeNull();
    });

    it("stops hinting after unsubscribe", async () => {
      const { a, b, newItem } = await setup();
      let ready = false;
      let changed = 0;
      const off = b.subscribe(
        () => changed++,
        () => (ready = true),
      );
      await waitFor(() => ready);
      off();
      const seen = changed;
      await a.upsert("items", [newItem()]);
      await new Promise((r) => setTimeout(r, 1000));
      expect(changed).toBe(seen);
    });

    it.each(REFUSALS)("refuses: $name ($code)", async ({ table, over, code, withItem }) => {
      const { a, refusals, newItem } = await setup();
      if (!refusals) return; // this server doesn't enforce the schema
      const now = new Date().toISOString();
      const row = (t: SyncedTable, o: Record<string, unknown>): SyncRow => ({ id: crypto.randomUUID(), updated_at: now, synced_at: now, ...refusals.extra, ...VALID[t], ...o });
      let parent: Record<string, unknown> = {};
      if (withItem) {
        const it = newItem();
        expect(await a.upsert("items", [it])).toBeNull();
        parent = { item_id: it.id };
      }
      expect((await a.upsert(table, [row(table, { ...parent, ...over })]))?.code).toBe(code);
      if (table === "time_entries" && !withItem) return;
      // …and the same row without the bad value is accepted.
      const ok = row(table, parent);
      expect(await a.upsert(table, [ok])).toBeNull();
    });

    it.each(CROSS_OWNER)("refuses: $name (23503)", async ({ child, column, parent }) => {
      const { a, refusals } = await setup();
      if (!refusals) return;
      const now = new Date().toISOString();
      const row = (t: SyncedTable, extra: Record<string, unknown>, o: Record<string, unknown> = {}): SyncRow => ({ id: crypto.randomUUID(), updated_at: now, synced_at: now, ...extra, ...VALID[t], ...o });
      const theirs = row(parent, refusals.other.extra);
      expect(await refusals.other.transport.upsert(parent, [theirs])).toBeNull();
      expect((await a.upsert(child, [row(child, refusals.extra, { [column]: theirs.id })]))?.code).toBe("23503");
      // …while a link to a parent of your own is fine.
      const mine = row(parent, refusals.extra);
      expect(await a.upsert(parent, [mine])).toBeNull();
      expect(await a.upsert(child, [row(child, refusals.extra, { [column]: mine.id })])).toBeNull();
    });

    it("hints other clients", async () => {
      const { a, b, newItem } = await setup();
      let ready = false;
      let changed = false;
      const off = b.subscribe(
        () => (changed = true),
        () => (ready = true),
      );
      try {
        await waitFor(() => ready);
        // Hints are best-effort: a change right after "ready" can slip past
        // while the channel warms up (the engine's catch-up pull covers it).
        // Keep writing until one gets through.
        await waitFor(async () => {
          await a.upsert("items", [newItem()]);
          await new Promise((r) => setTimeout(r, 500));
          return changed;
        });
      } finally {
        off();
      }
    });
  });
}