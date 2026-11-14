import type { Item, LocalDb } from "@/lib/sync/db";
import type { Mutations } from "@/lib/sync/mutate";
import { isLive, keyBetween } from "@/features/items/model";
import { EVERY_DAY, GENERATED_STAMP, isDue, occurrenceId } from "./model";

/** Make today's copy of every live routine due today, unless a copy for
    today already exists here — a deleted one too (deleting it is how a
    day gets skipped), or a task turned into the routine today. Idempotent;
    the derived id makes copies from other devices land on the same row.
    Returns how many copies it made. */
export async function ensureToday(db: LocalDb, m: Mutations, today: string): Promise<number> {
  const routines = (await db.routines.filter(isLive).toArray()).filter((r) => isDue(r.days, today));
  if (!routines.length) return 0;
  const dayItems = await db.items.where("[plan_scope+plan_date]").equals(["day", today]).toArray();
  const has = new Set(dayItems.map((i) => i.routine_id));
  let last = dayItems.filter(isLive).reduce<string | null>((max, i) => (max === null || i.sort_key > max ? i.sort_key : max), null);
  let made = 0;
  for (const r of routines) {
    if (has.has(r.id)) continue;
    const sort_key = keyBetween(last, null);
    const wrote = await m.ensure(
      "items",
      {
        id: await occurrenceId(r.id, today),
        title: r.title,
        notes: "",
        status: "todo",
        priority: r.priority,
        plan_scope: "day",
        plan_date: today,
        board_id: null,
        column_id: null,
        goal_id: r.goal_id,
        routine_id: r.id,
        sort_key,
        done_at: null,
      },
      GENERATED_STAMP,
    );
    if (wrote) {
      made++;
      last = sort_key;
    }
  }
  return made;
}

/** Last sort key in today's day list. */
async function lastTodayKey(db: LocalDb, today: string): Promise<string | null> {
  const rows = await db.items.where("[plan_scope+plan_date]").equals(["day", today]).filter(isLive).toArray();
  return rows.reduce<string | null>((max, i) => (max === null || i.sort_key > max ? i.sort_key : max), null);
}

/** Turn a task into a routine. The task becomes today's copy: it's linked
    and moved to today (wherever it was), so the runner sees today covered
    and doesn't add a second one. One transaction, so there's never a
    routine without its copy for the runner to fill in. */
export function routineFromTask(db: LocalDb, m: Mutations, item: Item, today: string, days = EVERY_DAY): Promise<string> {
  return db.transaction("rw", db.routines, db.items, db.outbox, async () => {
    const id = await m.insert("routines", { title: item.title, priority: item.priority, goal_id: item.goal_id, days });
    const onToday = item.plan_scope === "day" && item.plan_date === today;
    await m.update("items", item.id, onToday ? { routine_id: id } : { routine_id: id, plan_scope: "day", plan_date: today, sort_key: keyBetween(await lastTodayKey(db, today), null) });
    return id;
  });
}
