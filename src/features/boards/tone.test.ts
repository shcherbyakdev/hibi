import { describe, expect, it } from "vitest";
import { BOARD_TONES, boardTone, nextTone } from "./tone";

describe("board tones", () => {
  it("uses the stored colour, else a stable one from the id", () => {
    expect(boardTone({ id: "x", icon: "green" })).toBe(BOARD_TONES.green);
    expect(boardTone({ id: "abc", icon: null })).toBe(boardTone({ id: "abc", icon: "not-a-tone" }));
  });
  it("gives a new board the least-used colour", () => {
    expect(nextTone([])).toBe("periwinkle");
    expect(nextTone(["periwinkle"])).toBe("green");
    expect(nextTone(["periwinkle", "green", "pink", "orange", "purple", "blue"])).toBe("periwinkle");
    expect(nextTone(["periwinkle", "periwinkle", "green", null])).toBe("pink");
  });
});
