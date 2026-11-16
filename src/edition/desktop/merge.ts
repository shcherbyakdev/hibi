import { SYNCED_TABLES, type LocalDb } from "@/lib/sync/db";
import type { PullFrom, SyncRow, SyncTransport } from "@/lib/sync/transport";

const PAGE = 500;
const EPOCH = "1970-01-01T00:00:00.000Z";

/** Signing in merges this Mac's data into the account: every row in the
    built-in service (`source`) that the account's local db lacks, or holds
    an older copy of, is taken with the account as owner and queued for
    push. Ids are random UUIDs, so the two sets never collide; the server's
    last-write-wins settles a row both sides already share.
    A cursor per table (in the account db's meta) makes later launches skip
    what was taken. Sign-out deletes that db, so the next sign-in walks
    everything again: harmless, the rows are already there and no newer.
    Returns how many rows it queued. */
export async function mergeLocal(db: LocalDb, source: Pick<SyncTransport, "pull">, userId: string): Promise<number> {
  let taken = 0;
  for (const table of SYNCED_TABLES) {
    const key = `merge:${table}`;
    let from: PullFrom = { since: (await db.meta.get(key))?.value ?? EPOCH };
    for (;;) {
      const page = await source.pull(table, from, PAGE);
      if (!page.length) break;
      const last = page[page.length - 1];
      const t = db.table<SyncRow, string>(table);
      await db.transaction("rw", t, db.outbox, db.meta, async () => {
        const mine = await t.bulkGet(page.map((r) => r.id));
        const fresh = page.filter((r, i) => !mine[i] || Date.parse(r.updated_at) > Date.parse(mine[i].updated_at));
        await t.bulkPut(fresh.map((r) => ({ ...r, user_id: userId })));
        await db.outbox.bulkAdd(fresh.map((r) => ({ table, id: r.id })));
        await db.meta.put({ key, value: last.synced_at });
        taken += fresh.length;
      });
      if (page.length < PAGE) break;
      from = { after: { synced_at: last.synced_at, id: last.id } };
    }
  }
  return taken;
}
