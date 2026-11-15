import { describe, expect, it } from "vitest";
import { waitFor } from "@/test/supabase";
import type { SyncRow, SyncTransport } from "./transport";

export type ContractSetup = () => Promise<{
  /** Two clients of one user's data. */
  a: SyncTransport;
  b: SyncTransport;
  /** A fresh valid item row (new id each call). */
  newItem: () => SyncRow;
  /** An item row the server must refuse (e.g. an empty title). */
  refusedItem: () => SyncRow;
}>;

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
