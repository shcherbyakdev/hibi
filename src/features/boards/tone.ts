/* A board's colour, shown on its icon (sidebar, ⌘K, board page). Stored
   on the board (boards.icon holds the key) so it syncs and never changes
   on its own; new boards get the least-used colour, so neighbours differ.
   Keys are stored values — never rename one; change its colour or label.
   Colours come from the muted accent family (--tone-*, globals.css) plus
   the brand blue; "periwinkle" = brand blue, "blue" = teal. */
export const BOARD_TONES = {
  periwinkle: { cls: "text-brand", label: "Blue" },
  green: { cls: "text-tone-green", label: "Green" },
  pink: { cls: "text-tone-rose", label: "Rose" },
  orange: { cls: "text-tone-amber", label: "Amber" },
  purple: { cls: "text-tone-violet", label: "Violet" },
  blue: { cls: "text-tone-teal", label: "Teal" },
} as const;
export type BoardToneKey = keyof typeof BOARD_TONES;
const KEYS = Object.keys(BOARD_TONES) as BoardToneKey[];

const isTone = (v: string | null): v is BoardToneKey => v !== null && v in BOARD_TONES;

/** The colour class for a board; boards made before colours were stored
    fall back to one derived from the id. */
export function boardTone(board: { id: string; icon: string | null }): string {
  if (isTone(board.icon)) return BOARD_TONES[board.icon].cls;
  let h = 0;
  for (let i = 0; i < board.id.length; i++) h = (h * 31 + board.id.charCodeAt(i)) | 0;
  return BOARD_TONES[KEYS[Math.abs(h) % KEYS.length]].cls;
}

/** The least-used colour among existing boards (first in order on ties). */
export function nextTone(used: Array<string | null>): BoardToneKey {
  const count = new Map(KEYS.map((k) => [k, 0]));
  for (const u of used) if (isTone(u)) count.set(u, count.get(u)! + 1);
  return KEYS.reduce((best, k) => (count.get(k)! < count.get(best)! ? k : best), KEYS[0]);
}
