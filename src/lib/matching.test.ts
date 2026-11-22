import { describe, expect, it } from "vitest";
import {
  evaluateMatch,
  gotraClash,
  manglikOf,
  rankCandidates,
  readMatchingOptions,
  type MatchPref,
  type MatchProfile,
} from "./matching";

const now = new Date(Date.UTC(2026, 10, 21));
const dobForAge = (age: number) => new Date(Date.UTC(2026 - age, 0, 1));
const ctx = {
  now,
  educationOrder: ["10th", "12th", "Graduate", "MBA", "PhD"],
  incomeOrder: ["Up to ₹3 lakh", "₹3–5 lakh", "₹5–10 lakh", "₹10–20 lakh"],
};
const opts = readMatchingOptions({});

const noPref: MatchPref = {
  ageMin: null, ageMax: null, heightMinCm: null, heightMaxCm: null, religions: [], castes: [], excludeCastes: [],
  casteNoBar: false, maritalStatuses: [], manglik: null, countries: [], education: null, minIncome: null, diet: null,
};

function person(over: Partial<MatchProfile> & { id: string; gender: "MALE" | "FEMALE" }): MatchProfile {
  return {
    dob: dobForAge(28), heightCm: 170, maritalStatus: "NEVER_MARRIED", religion: "Sikh", caste: "Jatt",
    gotraSelf: null, gotraMother: null, gotraGrandmother: null, manglik: null, education: null, annualIncome: null,
    diet: null, country: "India", city: null, nativeDistrict: null, hasPhoto: true, urgent: false, preference: null,
    ...over,
  };
}

describe("hard rules", () => {
  it("never suggests the same gender", () => {
    const r = evaluateMatch(person({ id: "a", gender: "MALE" }), person({ id: "b", gender: "MALE" }), opts, ctx);
    expect(r.excluded).toContain("Same gender");
  });

  it("excludes on the client's must-have preferences", () => {
    const a = person({ id: "a", gender: "MALE", preference: { ...noPref, ageMin: 24, ageMax: 28, religions: ["Sikh"], excludeCastes: ["Saini"] } });
    expect(evaluateMatch(a, person({ id: "b", gender: "FEMALE", dob: dobForAge(30) }), opts, ctx).excluded[0]).toMatch(/age 30/);
    expect(evaluateMatch(a, person({ id: "b", gender: "FEMALE", religion: "Hindu" }), opts, ctx).excluded[0]).toMatch(/religion/);
    expect(evaluateMatch(a, person({ id: "b", gender: "FEMALE", caste: "Saini" }), opts, ctx).excluded[0]).toMatch(/excluded/);
    expect(evaluateMatch(a, person({ id: "b", gender: "FEMALE", dob: dobForAge(26) }), opts, ctx).excluded).toEqual([]);
  });

  it("checks the candidate's preferences too (two-way), unless turned off", () => {
    const a = person({ id: "a", gender: "MALE", maritalStatus: "DIVORCED" });
    const b = person({ id: "b", gender: "FEMALE", preference: { ...noPref, maritalStatuses: ["NEVER_MARRIED"] } });
    expect(evaluateMatch(a, b, opts, ctx).excluded[0]).toMatch(/^Their preference: divorced/);
    expect(evaluateMatch(a, b, { ...opts, twoWay: false }, ctx).excluded).toEqual([]);
  });

  it("missing data flags but never excludes", () => {
    const a = person({ id: "a", gender: "MALE", preference: { ...noPref, ageMin: 20, ageMax: 30 } });
    const r = evaluateMatch(a, person({ id: "b", gender: "FEMALE", dob: null }), opts, ctx);
    expect(r.excluded).toEqual([]);
    expect(r.warnings.join()).toMatch(/age not recorded/);
  });

  it("caste no bar disables the preferred-castes filter", () => {
    const pref = { ...noPref, castes: ["Jatt"] };
    const b = person({ id: "b", gender: "FEMALE", caste: "Saini" });
    expect(evaluateMatch(person({ id: "a", gender: "MALE", preference: pref }), b, opts, ctx).excluded).toHaveLength(1);
    expect(evaluateMatch(person({ id: "a", gender: "MALE", preference: { ...pref, casteNoBar: true } }), b, opts, ctx).excluded).toEqual([]);
    // with strictCastes off it only lowers the score
    expect(evaluateMatch(person({ id: "a", gender: "MALE", preference: pref }), b, { ...opts, strictCastes: false }, ctx).excluded).toEqual([]);
  });
});

describe("gotra rule", () => {
  const a = person({ id: "a", gender: "MALE", gotraSelf: "Sandhu", gotraMother: "Gill" });
  it("'all' compares every recorded gotra, ignoring case and spaces", () => {
    expect(gotraClash(a, person({ id: "b", gender: "FEMALE", gotraSelf: "gill " }), "all")).toBe("Same gotra (Gill)");
    expect(gotraClash(a, person({ id: "b", gender: "FEMALE", gotraSelf: "Dhillon", gotraGrandmother: "SANDHU" }), "all")).toMatch(/Sandhu/);
    expect(gotraClash(a, person({ id: "b", gender: "FEMALE", gotraSelf: "Dhillon" }), "all")).toBeNull();
  });
  it("'self' only compares own gotras; 'off' never excludes", () => {
    const b = person({ id: "b", gender: "FEMALE", gotraSelf: "Gill" });
    expect(gotraClash(a, b, "self")).toBeNull();
    expect(gotraClash(a, person({ id: "b", gender: "FEMALE", gotraSelf: "Sandhu" }), "self")).toMatch(/Sandhu/);
    expect(gotraClash(a, person({ id: "b", gender: "FEMALE", gotraSelf: "Sandhu" }), "off")).toBeNull();
  });
  it("no rule applies when a profile has no gotra recorded", () => {
    expect(gotraClash(a, person({ id: "b", gender: "FEMALE" }), "all")).toBeNull();
  });
});

describe("scoring", () => {
  it("reads manglik values", () => {
    expect(manglikOf("Yes")).toBe("yes");
    expect(manglikOf("No")).toBe("no");
    expect(manglikOf("Anshik (partial)")).toBe("partial");
    expect(manglikOf("Don't know")).toBeNull();
  });

  it("ranks a better fit higher and explains why", () => {
    const a = person({
      id: "a", gender: "MALE", dob: dobForAge(30), heightCm: 180, manglik: "No",
      preference: { ...noPref, education: "Graduate", diet: "Vegetarian", countries: ["Canada"] },
    });
    const good = person({ id: "good", gender: "FEMALE", dob: dobForAge(27), heightCm: 163, education: "MBA", diet: "Vegetarian", country: "Canada", manglik: "No" });
    const weak = person({ id: "weak", gender: "FEMALE", dob: dobForAge(33), heightCm: 182, education: "12th", diet: "Non-vegetarian", manglik: "Yes", hasPhoto: false, religion: "Hindu", caste: "Arora" });
    const { suggested } = rankCandidates(a, [weak, good], opts, ctx);
    expect(suggested.map((s) => s.candidateId)).toEqual(["good", "weak"]);
    expect(suggested[0].good.join()).toMatch(/Lives in Canada/);
    expect(suggested[1].warnings.join()).toMatch(/Bride is 3 years older.*Bride is taller.*Manglik mismatch.*Education below.*Diet.*No photo/);
  });

  it("keeps the score within 0–100", () => {
    const r = evaluateMatch(person({ id: "a", gender: "MALE" }), person({ id: "b", gender: "FEMALE" }), opts, ctx);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});
