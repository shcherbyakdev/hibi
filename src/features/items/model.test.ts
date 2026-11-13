import { describe, expect, it } from "vitest";
import { generateNKeysBetween } from "fractional-indexing";
import { bySortKey, keyBetween, keyForStep, parsePlaceId, placeId } from "./model";

describe("item model", () => {
  it("round-trips places through dnd group ids", () => {
    for (const p of [
      { plan_scope: "day" as const, plan_date: "2026-11-13" },
      { plan_scope: "week" as const, plan_date: "2026-11-09" },
      { plan_scope: "month" as const, plan_date: "2026-11-01" },
      { plan_scope: null, plan_date: null },
    ]) expect(parsePlaceId(placeId(p))).toEqual(p);
    expect(parsePlaceId("overdue")).toBeNull();
    expect(parsePlaceId("day:13-11-2026")).toBeNull();
  });

  it("mints a key between neighbours, at either end, and survives duplicates", () => {
    const [a, b] = generateNKeysBetween(null, null, 2);
    const mid = keyBetween(a, b);
    expect(a < mid && mid < b).toBe(true);
    expect(keyBetween(null, a) < a).toBe(true);
    expect(keyBetween(b, null) > b).toBe(true);
    expect(keyBetween(a, a) > a).toBe(true); // equal keys from two offline devices
    expect(typeof keyBetween(null, null)).toBe("string");
  });

  it("moves a row one step left or right, and refuses past the ends", () => {
    const keys = generateNKeysBetween(null, null, 4);
    const list = ["A", "B", "C", "D"].map((name, i) => ({ name, sort_key: keys[i] }));
    const order = (i: number, dir: -1 | 1) =>
      list
        .map((r, k) => (k === i ? { ...r, sort_key: keyForStep(list, i, dir)! } : r))
        .sort(bySortKey)
        .map((r) => r.name)
        .join("");
    expect(order(1, 1)).toBe("ACBD");
    expect(order(2, -1)).toBe("ACBD");
    expect(order(2, 1)).toBe("ABDC"); // into last place
    expect(order(1, -1)).toBe("BACD"); // into first place
    expect(keyForStep(list, 0, -1)).toBeNull();
    expect(keyForStep(list, 3, 1)).toBeNull();
  });
});
