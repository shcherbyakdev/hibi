import { describe, expect, it } from "vitest";
import { addDays, addMonths, isOverdue, monthGrid, periodOf, startOfMonth, startOfWeek, toISODate, weekDays } from "./periods";

describe("periods", () => {
  it("formats local dates, not UTC", () => {
    // Local midnight; toISOString() would print the previous day east of GMT.
    expect(toISODate(new Date(2026, 10, 1))).toBe("2026-11-01");
  });

  it("adds days and months across boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addMonths("2026-01-01", 1)).toBe("2026-02-01");
    expect(addMonths("2026-01-01", -1)).toBe("2025-12-01");
  });

  it("survives DST changes (adds calendar days, not 24h)", () => {
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26");
  });

  it("finds the start of a week for a configurable first day", () => {
    expect(startOfWeek("2026-11-13")).toBe("2026-11-09"); // Fri → Mon
    expect(startOfWeek("2026-11-09")).toBe("2026-11-09"); // Mon stays
    expect(startOfWeek("2026-11-15")).toBe("2026-11-09"); // Sun → previous Mon
    expect(startOfWeek("2026-11-13", 0)).toBe("2026-11-08"); // Sunday-first
    expect(startOfWeek("2026-11-08", 0)).toBe("2026-11-08");
  });

  it("lists a week's days and a month's grid", () => {
    expect(weekDays("2026-11-09")).toEqual(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"]);
    const grid = monthGrid("2026-11-01");
    expect(startOfMonth("2026-11-13")).toBe("2026-11-01");
    expect(grid[0][0]).toBe("2026-10-26"); // Nov 1 2026 is a Sunday
    expect(grid.at(-1)!.at(-1)).toBe("2026-12-06");
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid.flat()).toContain("2026-11-30");
  });

  it("maps a scope + any date to its period start", () => {
    expect(periodOf("day", "2026-11-13")).toBe("2026-11-13");
    expect(periodOf("week", "2026-11-13")).toBe("2026-11-09");
    expect(periodOf("month", "2026-11-13")).toBe("2026-11-01");
  });

  it("calls an open item overdue once its whole period has passed", () => {
    const today = "2026-11-13";
    const it_ = (plan_scope: "day" | "week" | "month", plan_date: string, status = "todo") => ({ plan_scope, plan_date, status });
    expect(isOverdue(it_("day", "2026-11-12"), today)).toBe(true);
    expect(isOverdue(it_("day", "2026-11-13"), today)).toBe(false);
    expect(isOverdue(it_("week", "2026-11-09"), today)).toBe(false); // this week
    expect(isOverdue(it_("week", "2026-11-02"), today)).toBe(true);
    expect(isOverdue(it_("month", "2026-11-01"), today)).toBe(false);
    expect(isOverdue(it_("month", "2026-10-01"), today)).toBe(true);
    expect(isOverdue(it_("day", "2026-11-12", "done"), today)).toBe(false);
    expect(isOverdue({ plan_scope: null, plan_date: null, status: "todo" }, today)).toBe(false);
  });
});
