import { expect, it } from "vitest";
import { suggestions } from "./suggest";

const t = (title: string, priority = 0, status = "todo") => ({ title, priority, status: status as "todo" });
const titles = (xs: { title: string }[]) => xs.map((x) => x.title);

it("suggests this week's open tasks, most urgent first", () => {
  const week = [t("low", 4), t("none"), t("done", 1, "done"), t("urgent", 1)];
  expect(titles(suggestions(week, [t("month")], "2026-11-16"))).toEqual(["urgent", "low", "none"]);
});

it("adds the month's bucket only in its last week, and caps the list", () => {
  const month = [t("m1", 2), t("m2")];
  expect(titles(suggestions([], month, "2026-11-23"))).toEqual([]);
  expect(titles(suggestions([], month, "2026-11-24"))).toEqual(["m1", "m2"]);
  expect(suggestions([t("a"), t("b"), t("c")], month, "2026-11-30", 2)).toHaveLength(2);
});
