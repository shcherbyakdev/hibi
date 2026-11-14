/* A goal's colour (sidebar, ⌘K, goal page, grid). Stored on the goal
   (goals.icon holds the key) so it syncs and never changes on its own;
   new goals get the least-used colour, so neighbours differ.
   Keys are stored values — never rename one; change its colour or label.
   Colours come from the muted accent family (--tone-*, globals.css) plus
   the brand blue; "periwinkle" = brand blue, "blue" = teal. */
export const TONES = {
  periwinkle: { cls: "text-brand", label: "Blue" },
  green: { cls: "text-tone-green", label: "Green" },
  pink: { cls: "text-tone-rose", label: "Rose" },
  orange: { cls: "text-tone-amber", label: "Amber" },
  purple: { cls: "text-tone-violet", label: "Violet" },
  blue: { cls: "text-tone-teal", label: "Teal" },
} as const;
export type ToneKey = keyof typeof TONES;
const KEYS = Object.keys(TONES) as ToneKey[];

const isTone = (v: string | null): v is ToneKey => v !== null && v in TONES;

/** The colour class for a goal; rows made before colours were stored
    fall back to one derived from the id. */
export function toneClass(row: { id: string; icon: string | null }): string {
  if (isTone(row.icon)) return TONES[row.icon].cls;
  let h = 0;
  for (let i = 0; i < row.id.length; i++) h = (h * 31 + row.id.charCodeAt(i)) | 0;
  return TONES[KEYS[Math.abs(h) % KEYS.length]].cls;
}

/** The least-used colour among existing goals (first in order on ties). */
export function nextTone(used: Array<string | null>): ToneKey {
  const count = new Map(KEYS.map((k) => [k, 0]));
  for (const u of used) if (isTone(u)) count.set(u, count.get(u)! + 1);
  return KEYS.reduce((best, k) => (count.get(k)! < count.get(best)! ? k : best), KEYS[0]);
}
