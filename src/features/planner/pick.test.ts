import { expect, it } from "vitest";
import { pickSources } from "./pick";

const t = (title: string, priority = 0, status = "todo") => ({ title, priority, status: status as "todo" });

it("offers every source nearest first, open tasks only, most urgent first, skipping empty ones", () => {
  const got = pickSources({
    week: [t("w low", 4), t("w none"), t("w done", 1, "done"), t("w urgent", 1)],
    month: [t("m dropped", 0, "dropped")],
    goals: [t("g1"), t("g2", 2)],
    inbox: [t("i1")],
  });
  expect(got.map((s) => [s.source, s.items.map((i) => i.title)])).toEqual([
    ["week", ["w urgent", "w low", "w none"]],
    ["goals", ["g2", "g1"]],
    ["inbox", ["i1"]],
  ]);
});
