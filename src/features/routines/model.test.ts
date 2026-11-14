import { afterEach, describe, expect, it } from "vitest";
import { dayBit, dayOrder, EVERY_DAY, isDue, occurrenceId, toggleDay } from "./model";

const realTZ = process.env.TZ;
afterEach(() => {
  process.env.TZ = realTZ;
});

describe("routine rules", () => {
  it("is due on the days in its mask", () => {
    expect(isDue(EVERY_DAY, "2026-11-14")).toBe(true);
    expect(isDue(dayBit("2026-11-14"), "2026-11-14")).toBe(true); // Saturday
    expect(isDue(dayBit("2026-11-14"), "2026-11-15")).toBe(false);
    const weekdays = 0b0111110;
    expect(isDue(weekdays, "2026-11-09")).toBe(true); // Monday
    expect(isDue(weekdays, "2026-11-08")).toBe(false); // Sunday
  });

  it("reads the weekday from the local date east of UTC", () => {
    process.env.TZ = "Asia/Tokyo";
    expect(dayBit("2026-11-14")).toBe(1 << 6);
    expect(isDue(1 << 6, "2026-11-14")).toBe(true);
  });

  it("toggles a day but never empties the mask", () => {
    expect(toggleDay(EVERY_DAY, 0)).toBe(126);
    expect(toggleDay(126, 0)).toBe(EVERY_DAY);
    expect(toggleDay(1, 0)).toBe(1);
  });

  it("orders days by the week-start setting", () => {
    expect(dayOrder(1)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(dayOrder(0)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("derives one stable v5-shaped id per routine and date", async () => {
    const a = await occurrenceId("r1", "2026-11-14");
    expect(a).toBe(await occurrenceId("r1", "2026-11-14"));
    expect(a).not.toBe(await occurrenceId("r1", "2026-11-15"));
    expect(a).not.toBe(await occurrenceId("r2", "2026-11-14"));
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
