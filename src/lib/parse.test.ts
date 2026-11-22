import { describe, expect, it } from "vitest";
import {
  ParseError,
  normalisePhone,
  parseDateLoose,
  parseGender,
  parseHeightCm,
  parseList,
  parseMaritalStatus,
  phoneKey,
} from "./parse";

const iso = (d: Date | null) => d?.toISOString().slice(0, 10);

describe("parseDateLoose", () => {
  it("reads Indian day-first dates", () => {
    expect(iso(parseDateLoose("15/08/1995"))).toBe("1995-08-15");
    expect(iso(parseDateLoose("5-1-1990"))).toBe("1990-01-05"); // 5 Jan, not 1 May
    expect(iso(parseDateLoose("15.08.95"))).toBe("1995-08-15");
    expect(iso(parseDateLoose("01/02/03"))).toBe("2003-02-01");
  });
  it("reads ISO, month names and Excel serials", () => {
    expect(iso(parseDateLoose("1995-08-15"))).toBe("1995-08-15");
    expect(iso(parseDateLoose("15 Aug 1995"))).toBe("1995-08-15");
    expect(iso(parseDateLoose("15 August 1995"))).toBe("1995-08-15");
    expect(iso(parseDateLoose("34926"))).toBe("1995-08-15");
  });
  it("is stored at UTC midnight so the day never shifts", () => {
    expect(parseDateLoose("15/08/1995")!.toISOString()).toBe("1995-08-15T00:00:00.000Z");
  });
  it("rejects impossible dates and returns null for blanks", () => {
    expect(() => parseDateLoose("31/02/1995")).toThrow(ParseError);
    expect(() => parseDateLoose("13/13/1995")).toThrow(ParseError);
    expect(() => parseDateLoose("tomorrow")).toThrow(ParseError);
    expect(parseDateLoose("  ")).toBeNull();
  });
});

describe("parseHeightCm", () => {
  it.each([
    [`5'6"`, 168],
    ["5'6", 168],
    ["5' 6\"", 168],
    ["5 ft 6 in", 168],
    ["5ft", 152],
    ["5.6", 168],
    ["5-6", 168],
    ["5.11", 180],
    ["6", 183],
    ["168", 168],
    ["168 cm", 168],
    ["1.68 m", 168],
    ["5’4”", 163],
  ])("%s → %i cm", (input, cm) => {
    expect(parseHeightCm(input)).toBe(cm);
  });
  it("rejects nonsense", () => {
    expect(() => parseHeightCm("5'14")).toThrow(ParseError);
    expect(() => parseHeightCm("tall")).toThrow(ParseError);
    expect(() => parseHeightCm("999")).toThrow(ParseError);
  });
});

describe("gender & marital status", () => {
  it("accepts common spellings", () => {
    expect(parseGender("Boy")).toBe("MALE");
    expect(parseGender("F")).toBe("FEMALE");
    expect(parseGender("Kudi")).toBe("FEMALE");
    expect(parseMaritalStatus("Unmarried")).toBe("NEVER_MARRIED");
    expect(parseMaritalStatus("Divorcee")).toBe("DIVORCED");
    expect(parseMaritalStatus("divorce in process")).toBe("AWAITING_DIVORCE");
    expect(parseMaritalStatus("Widower")).toBe("WIDOWED");
    expect(() => parseGender("x")).toThrow(ParseError);
  });
});

describe("phones & lists", () => {
  it("normalises phones and matches across formats", () => {
    expect(normalisePhone("+91 98140-12345")).toBe("+919814012345");
    expect(normalisePhone("098140 12345")).toBe("09814012345");
    expect(phoneKey("+919814012345")).toBe(phoneKey("09814012345"));
    expect(phoneKey("9814012345")).toBe("9814012345");
    expect(() => normalisePhone("12")).toThrow(ParseError);
  });
  it("splits lists", () => {
    expect(parseList("Jatt, Saini; Kamboj / Jatt")).toEqual(["Jatt", "Saini", "Kamboj"]);
    expect(parseList("")).toEqual([]);
  });
});
