import { describe, expect, it } from "vitest";
import { chunk, presetOf, readShareOptions } from "./share";

const defaults = { sections: ["photo", "basic", "religion", "career", "family"] as const, lang: "en" as const };
const d = { sections: [...defaults.sections], lang: defaults.lang };

describe("share options", () => {
  it("defaults: full for one profile, 2 per page for several", () => {
    expect(readShareOptions({}, d, 1)).toMatchObject({ layout: "full", lang: "en", sections: d.sections });
    expect(readShareOptions({}, d, 5).layout).toBe("two");
  });
  it("presets and custom sections, unknown values dropped, bureau order kept", () => {
    expect(readShareOptions({ preset: "minimal" }, d).sections).toEqual(["basic", "religion", "career", "location"]);
    expect(readShareOptions({ sections: "career,basic,bogus" }, d).sections).toEqual(["basic", "career"]);
    expect(readShareOptions({ layout: "nope", lang: "xx" }, d, 3)).toMatchObject({ layout: "two", lang: "en" });
  });
  it("recognises presets", () => {
    expect(presetOf(["basic", "religion", "career", "location"], d.sections)).toBe("minimal");
    expect(presetOf([...d.sections], d.sections)).toBe("full");
    expect(presetOf(["basic"], d.sections)).toBeNull();
  });
  it("chunks", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
