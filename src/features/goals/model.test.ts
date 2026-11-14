import { afterEach, describe, expect, it } from "vitest";
import { dayCounts, gridWeeks, level, openSteps, streak, weekCount } from "./model";

const done = (at: string, over = {}) => ({ goal_id: "g", done_at: at, deleted_at: null, ...over });
const realTZ = process.env.TZ;
afterEach(() => {
  process.env.TZ = realTZ;
});

describe("goal progress", () => {
  it("counts done tasks per local day, skipping other goals, open and deleted tasks", () => {
    const c = dayCounts(
      [
        done("2026-11-12T08:00:00"),
        done("2026-11-12T18:00:00"),
        done("2026-11-12T09:00:00", { goal_id: "x" }),
        done("2026-11-12T10:00:00", { deleted_at: "2026-11-13T00:00:00Z" }),
        { goal_id: "g", done_at: null, deleted_at: null },
      ],
      "g",
    );
    expect([...c]).toEqual([["2026-11-12", 2]]);
  });

  it("uses the local day east of UTC", () => {
    process.env.TZ = "Asia/Tokyo"; // Node re-reads TZ on change
    expect([...dayCounts([done("2026-11-12T15:30:00Z")], "g").keys()]).toEqual(["2026-11-13"]);
  });

  it("levels like GitHub", () => expect([0, 1, 2, 3, 4, 9].map(level)).toEqual([0, 1, 2, 3, 4, 4]));

  it("grid ends on today's week and starts rows on the week-start day", () => {
    const g = gridWeeks("2026-11-14", 2, 1); // Saturday, Monday weeks
    expect(g).toEqual([
      ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"],
      ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"],
    ]);
    expect(gridWeeks("2026-11-14", 1, 0)[0][0]).toBe("2026-11-08");
  });

  it("streak survives an empty today and breaks on a gap", () => {
    const c = new Map([["2026-11-13", 1], ["2026-11-12", 2], ["2026-11-10", 1]]);
    expect(streak(c, "2026-11-14")).toBe(2);
    expect(streak(new Map([...c, ["2026-11-14", 1]]), "2026-11-14")).toBe(3);
    expect(streak(new Map(), "2026-11-14")).toBe(0);
  });

  it("weekCount counts days, not tasks, in the current week", () => {
    const c = new Map([["2026-11-09", 3], ["2026-11-14", 1], ["2026-11-08", 1]]);
    expect(weekCount(c, "2026-11-14", 1)).toBe(2);
    expect(weekCount(c, "2026-11-14", 0)).toBe(3); // Sunday week Nov 8–14 holds all three
  });

  it("lists open steps without piling up missed routine days", () => {
    const step = (id: string, over = {}) => ({ id, status: "todo" as const, routine_id: null, plan_date: null, ...over });
    const open = openSteps(
      [
        step("plain"),
        step("old-plain", { plan_date: "2026-11-01" }),
        step("done", { status: "done" as const }),
        step("missed-copy", { routine_id: "r", plan_date: "2026-11-13" }),
        step("today-copy", { routine_id: "r", plan_date: "2026-11-14" }),
      ],
      "2026-11-14",
    );
    expect(open.map((i) => i.id)).toEqual(["plain", "old-plain", "today-copy"]);
  });
});
