import { describe, expect, it } from "vitest";
import { PRESETS, presetOf, readFeatures } from "./features";

describe("features", () => {
  it("default to everything on (existing bureaus unchanged)", () => {
    const f = readFeatures(null);
    expect(Object.values(f).every(Boolean)).toBe(true);
    expect(readFeatures({ payments: false }).payments).toBe(false);
    expect(readFeatures({ payments: "nonsense" }).payments).toBe(true);
  });
  it("recognises presets", () => {
    expect(presetOf(PRESETS.simple.features, false)).toBe("simple");
    expect(presetOf(PRESETS.advanced.features, true)).toBe("advanced");
    expect(presetOf(PRESETS.advanced.features, false)).toBeNull();
  });
});
