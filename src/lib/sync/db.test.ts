import { describe, expect, it } from "vitest";
import { foldBoardItem } from "./db";

// Must agree with migration 0011's UPDATE (the server-side fold).
describe("foldBoardItem (Dexie v6 upgrade)", () => {
  const base = { board_id: "b", goal_id: null, status: "todo", done_at: null, updated_at: "2026-11-01T10:00:00Z" };
  it("joins the board's goal unless the task has its own", () => {
    expect(foldBoardItem(base, undefined)).toEqual({ goal_id: "b" });
    expect(foldBoardItem({ ...base, goal_id: "own" }, undefined)).toEqual({ goal_id: "own" });
  });
  it("maps Done and Doing columns to a status, stamping done_at", () => {
    expect(foldBoardItem(base, "done")).toEqual({ goal_id: "b", status: "done", done_at: base.updated_at });
    expect(foldBoardItem({ ...base, done_at: "2026-11-02T00:00:00Z" }, "done")).toMatchObject({ done_at: "2026-11-02T00:00:00Z" });
    expect(foldBoardItem(base, "doing")).toEqual({ goal_id: "b", status: "doing" });
    expect(foldBoardItem({ ...base, status: "done" }, "doing")).toEqual({ goal_id: "b" });
  });
  it("leaves dropped tasks dropped", () => {
    expect(foldBoardItem({ ...base, status: "dropped" }, "done")).toEqual({ goal_id: "b" });
  });
});
