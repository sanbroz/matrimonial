import { describe, expect, it } from "vitest";
import { guessMapping, mapRow, nameDobKey } from "./import-mapping";

describe("guessMapping", () => {
  it("recognises typical register headers", () => {
    const m = guessMapping(["S.No", "Name", "Father Name", "D.O.B", "Height", "Caste", "Gotra", "Mobile No.", "Village", "Remarks"]);
    expect(m).toEqual([null, "fullName", "fatherName", "dob", "heightCm", "caste", "gotraSelf", "phone", "nativePlace", "about"]);
  });
  it("matches the template's own labels and never maps a field twice", () => {
    const m = guessMapping(["Full name", "Gender", "Phone", "Mobile"]);
    expect(m).toEqual(["fullName", "gender", "phone", null]);
  });
});

describe("mapRow", () => {
  const mapping = ["fullName", "gender", "dob", "heightCm", "phone", null];

  it("parses a good row", () => {
    const r = mapRow(["Simran Kaur", "Girl", "15/08/1997", "5.4", "98765 00000", "junk"], mapping, 2);
    expect(r.errors).toEqual([]);
    expect(r.profile).toMatchObject({ fullName: "Simran Kaur", gender: "FEMALE", heightCm: 163, phone: "9876500000" });
    expect((r.profile.dob as Date).toISOString().slice(0, 10)).toBe("1997-08-15");
  });

  it("reports problems per row", () => {
    const r = mapRow(["", "x", "32/01/1990", "", "", ""], mapping, 3);
    expect(r.errors.length).toBe(3); // name required, bad gender, bad date
  });

  it("uses the default gender only when the cell is empty", () => {
    const m = ["fullName", "gender"];
    expect(mapRow(["A", ""], m, 2, { gender: "MALE" }).profile.gender).toBe("MALE");
    expect(mapRow(["A", "F"], m, 2, { gender: "MALE" }).profile.gender).toBe("FEMALE");
    expect(mapRow(["A"], ["fullName"], 2, { gender: "FEMALE" }).profile.gender).toBe("FEMALE");
    expect(mapRow(["A"], ["fullName"], 2).errors).toEqual(["Gender is required"]);
  });

  it("leaves unmapped fields out so they keep their database defaults", () => {
    const r = mapRow(["A", "M"], ["fullName", "gender"], 2);
    expect(Object.keys(r.profile).sort()).toEqual(["fullName", "gender"]);
  });
});

describe("nameDobKey", () => {
  it("treats spacing, case and dots alike", () => {
    const d = new Date("1995-04-12T00:00:00Z");
    expect(nameDobKey("Gurpreet  Singh", d)).toBe(nameDobKey("gurpreet singh.", d));
    expect(nameDobKey("Gurpreet Singh", d)).toBe("gurpreet singh|1995-04-12");
  });
  it("needs both a name and a date of birth", () => {
    expect(nameDobKey("Gurpreet Singh", null)).toBeNull();
    expect(nameDobKey("", new Date())).toBeNull();
    expect(nameDobKey("Gurpreet", new Date("x"))).toBeNull();
  });
});

describe("nameDobKey (Gurmukhi)", () => {
  it("keeps vowel signs, so different Punjabi names stay different", () => {
    const d = new Date("1995-04-12T00:00:00Z");
    expect(nameDobKey("ਗੁਰਪ੍ਰੀਤ ਸਿੰਘ", d)).toBe("ਗੁਰਪ੍ਰੀਤ ਸਿੰਘ|1995-04-12");
    expect(nameDobKey("ਗੁਰਪ੍ਰੀਤ ਸਿੰਘ", d)).not.toBe(nameDobKey("ਗਰਪਰਤ ਸਘ", d));
  });
});
