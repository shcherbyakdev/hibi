import { describe, expect, it } from "vitest";
import { TONES, toneClass, nextTone } from "@/lib/tone";

describe("board tones", () => {
  it("uses the stored colour, else a stable one from the id", () => {
    expect(toneClass({ id: "x", icon: "green" })).toBe(TONES.green.cls);
    expect(toneClass({ id: "abc", icon: null })).toBe(toneClass({ id: "abc", icon: "not-a-tone" }));
  });
  it("gives a new board the least-used colour", () => {
    expect(nextTone([])).toBe("periwinkle");
    expect(nextTone(["periwinkle"])).toBe("green");
    expect(nextTone(["periwinkle", "green", "pink", "orange", "purple", "blue"])).toBe("periwinkle");
    expect(nextTone(["periwinkle", "periwinkle", "green", null])).toBe("pink");
  });
});
