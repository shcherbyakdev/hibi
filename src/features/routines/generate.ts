import type { LocalDb } from "@/lib/sync/db";
import type { Mutations } from "@/lib/sync/mutate";
import { isLive, keyBetween } from "@/features/items/model";
import { GENERATED_STAMP, isDue, occurrenceId } from "./model";

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
