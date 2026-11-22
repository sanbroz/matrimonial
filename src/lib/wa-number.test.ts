import { describe, expect, it } from "vitest";
import { toWhatsAppNumber } from "./wa-number";

describe("toWhatsAppNumber", () => {
  it.each([
    ["98140 12345", "919814012345"],
    ["09814012345", "919814012345"],
    ["+91 98140-12345", "919814012345"],
    ["919814012345", "919814012345"],
    ["+1 604 555 0199", "16045550199"],
    ["+44 20 7946 0958", "442079460958"],
  ])("%s → %s", (input, out) => expect(toWhatsAppNumber(input)).toBe(out));
  it("rejects junk", () => {
    expect(toWhatsAppNumber("12345")).toBeNull();
    expect(toWhatsAppNumber("")).toBeNull();
    expect(toWhatsAppNumber(null)).toBeNull();
  });
});
