import { describe, expect, it } from "vitest";
import { clamp, parsePlacement } from "./placement";

describe("toolbox placement", () => {
  it("falls back to hidden for missing, broken or unknown stored values", () => {
    expect(parsePlacement(null)).toEqual({ mode: "hidden", last: "floating", x: -1, y: -1 });
    expect(parsePlacement("not json")).toEqual(parsePlacement(null));
    expect(parsePlacement('{"mode":"sideways"}')).toEqual(parsePlacement(null));
    expect(parsePlacement("null")).toEqual(parsePlacement(null));
  });

  it("reads a stored placement", () => {
    expect(parsePlacement('{"mode":"docked","last":"docked","x":10,"y":20}')).toEqual({ mode: "docked", last: "docked", x: 10, y: 20 });
  });

  it("keeps the floating card inside the viewport", () => {
    expect(clamp({ x: 900, y: 700 }, { w: 320, h: 400 }, { w: 1000, h: 800 })).toEqual({ x: 672, y: 392 });
    expect(clamp({ x: -50, y: -50 }, { w: 320, h: 400 }, { w: 1000, h: 800 })).toEqual({ x: 8, y: 8 });
  });

  it("pins to the top-left margin when the viewport is smaller than the card", () => {
    expect(clamp({ x: 100, y: 100 }, { w: 320, h: 400 }, { w: 300, h: 300 })).toEqual({ x: 8, y: 8 });
  });
});
