import { describe, expect, it } from "vitest";
import { clock, dueToClose, focusSeconds, formatTotal, pomodorosDone, sessionSeconds, totalsByItem } from "./model";

const t = (s: string) => `2026-11-13T${s}.000Z`;
const at = (s: string) => Date.parse(t(s));
const entry = (o: { item?: string; start: string; end?: string | null; planned?: number | null; id?: string }) => ({
  id: o.id ?? o.start,
  item_id: o.item ?? "a",
  started_at: t(o.start),
  ended_at: o.end ? t(o.end) : null,
  planned_seconds: o.planned ?? null,
  deleted_at: null,
});

describe("time model", () => {
  it("counts a session up to its end, or now while running", () => {
    expect(sessionSeconds(entry({ start: "10:00:00", end: "10:25:30" }), 0)).toBe(1530);
    expect(sessionSeconds(entry({ start: "10:00:00" }), at("10:01:05"))).toBe(65);
  });

  it("caps a pomodoro at its planned length, even if left running", () => {
    expect(sessionSeconds(entry({ start: "10:00:00", planned: 1500 }), at("11:00:00"))).toBe(1500);
    expect(sessionSeconds(entry({ start: "10:00:00", planned: 1500 }), at("10:10:00"))).toBe(600);
  });

  it("totals per item, skipping deleted sessions", () => {
    const now = at("12:00:00");
    const totals = totalsByItem(
      [
        entry({ start: "09:00:00", end: "09:30:00" }),
        entry({ start: "10:00:00", end: "10:10:00" }),
        entry({ item: "b", start: "11:59:00" }),
        { ...entry({ start: "08:00:00", end: "09:00:00" }), deleted_at: t("09:00:00") },
      ],
      now,
    );
    expect(totals.get("a")).toBe(2400);
    expect(totals.get("b")).toBe(60);
  });

  it("closes a pomodoro that ran past its length at exactly its end", () => {
    const due = dueToClose([entry({ start: "10:00:00", planned: 1500 })], at("10:30:00"));
    expect(due).toEqual([{ id: "10:00:00", ended_at: t("10:25:00"), reason: "pomodoro" }]);
    expect(dueToClose([entry({ start: "10:00:00", planned: 1500 })], at("10:20:00"))).toEqual([]);
  });

  it("keeps only the newest running timer (two devices), closing the rest where it began", () => {
    const due = dueToClose([entry({ id: "old", start: "10:00:00" }), entry({ id: "new", item: "b", start: "10:05:00" })], at("10:06:00"));
    expect(due).toEqual([{ id: "old", ended_at: t("10:05:00"), reason: "superseded" }]);
  });

  it("formats clocks and totals", () => {
    expect(clock(65)).toBe("1:05");
    expect(clock(3723)).toBe("1:02:03");
    expect(formatTotal(30)).toBe("<1m");
    expect(formatTotal(25 * 60)).toBe("25m");
    expect(formatTotal(85 * 60)).toBe("1h 25m");
    expect(formatTotal(2 * 3600)).toBe("2h");
  });

  it("counts only finished pomodoros on the item, started in the day", () => {
    const day = [at("00:00:00"), at("23:59:59") + 1000] as const;
    const es = [
      entry({ start: "09:00:00", end: "09:25:00", planned: 1500 }), // done
      entry({ start: "10:00:00", end: "10:10:00", planned: 1500 }), // paused early
      entry({ start: "11:00:00", end: "11:30:00" }), // plain timer
      entry({ start: "12:00:00", end: "12:25:00", planned: 1500, item: "b" }), // other item
      { ...entry({ start: "13:00:00", end: "13:25:00", planned: 1500 }), deleted_at: t("14:00:00") },
      entry({ start: "15:00:00", planned: 1500 }), // running, left open
    ];
    expect(pomodorosDone(es, "a", ...day, at("15:10:00"))).toBe(1);
    expect(pomodorosDone(es, "a", ...day, at("16:00:00"))).toBe(2); // the open one reached 25m
  });

  it("sums focus time for sessions started in the day", () => {
    const es = [entry({ start: "09:00:00", end: "09:30:00" }), entry({ start: "10:00:00", planned: 1500 })];
    expect(focusSeconds(es, at("00:00:00"), at("23:59:59") + 1000, at("11:00:00"))).toBe(1800 + 1500);
    // a session started before the day doesn't count
    expect(focusSeconds(es, at("09:30:00"), at("23:59:59"), at("11:00:00"))).toBe(1500);
  });
});
