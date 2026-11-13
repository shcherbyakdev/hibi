import { describe, expect, it } from "vitest";
import { generateNKeysBetween } from "fractional-indexing";
import { keyBetween, parsePlaceId, placeId } from "./model";

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
});
