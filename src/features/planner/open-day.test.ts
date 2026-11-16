import { describe, expect, it } from "vitest";
import { cellClickIntent, isCellBackground, openTracks, shouldCloseOnKey } from "./open-day";

const ONE = "minmax(0,1fr)", OPEN = "minmax(20rem,3fr)";

describe("openTracks", () => {
  it("is seven equal tracks when nothing is open", () => {
    expect(openTracks(7, -1)).toBe(Array(7).fill(ONE).join(" "));
  });
  it("widens only the open index", () => {
    expect(openTracks(7, 2).split(" ")).toEqual([ONE, ONE, OPEN, ONE, ONE, ONE, ONE]);
    expect(openTracks(7, 6).split(" ").at(-1)).toBe(OPEN);
  });
});

describe("isCellBackground", () => {
  it("ignores clicks inside interactive elements", () => {
    expect(isCellBackground({ closest: () => ({}) })).toBe(false);
    expect(isCellBackground({ closest: () => null })).toBe(true);
    expect(isCellBackground(null)).toBe(true);
  });
});

describe("shouldCloseOnKey", () => {
  it("closes on a plain Escape only", () => {
    expect(shouldCloseOnKey({ key: "Escape", defaultPrevented: false, target: null })).toBe(true);
    expect(shouldCloseOnKey({ key: "Escape", defaultPrevented: true, target: null })).toBe(false);
    expect(shouldCloseOnKey({ key: "ArrowLeft", defaultPrevented: false, target: null })).toBe(false);
  });
});

describe("cellClickIntent", () => {
  it("opens on a single click on empty space", () => {
    expect(cellClickIntent(1, true, false)).toBe("open");
    expect(cellClickIntent(1, false, false)).toBe(null);
  });
  // The first click swaps chips for taller cards, so the second click can land
  // on a card: where the FIRST click landed decides.
  it("adds on a double-click that started on empty space, wherever the second lands", () => {
    expect(cellClickIntent(2, false, true)).toBe("add");
    expect(cellClickIntent(2, true, true)).toBe("add");
    expect(cellClickIntent(2, true, false)).toBe(null);
  });
});
