import { describe, expect, it } from "vitest";
import { buildBiodata, type BiodataProfile } from "./biodata";
import { readBiodataOptions } from "./biodata-options";

const now = new Date(Date.UTC(2026, 10, 21));

const base: BiodataProfile = {
  code: "PM1042", gender: "FEMALE", dob: new Date(Date.UTC(1997, 7, 15)), birthTime: "6:45 AM", birthPlace: "Ludhiana",
  heightCm: 163, weightKg: null, complexion: "Fair", bodyType: null, maritalStatus: "NEVER_MARRIED", childrenCount: 0,
  childrenLivingWith: null, disability: null, diet: "Vegetarian", smoking: null, drinking: null, motherTongue: "Punjabi",
  about: "Cheerful, family oriented.", religion: "Sikh", caste: "Jatt", subCaste: null, gotraSelf: "Gill",
  gotraMother: "Sandhu", gotraGrandmother: null, sikhStatus: "Keshdhari", manglik: null, rashi: null, nakshatra: null,
  education: "MBA", educationDetail: "Punjab University", profession: "Private job", annualIncome: "₹5–10 lakh",
  city: "Mohali", state: "Punjab", country: "India", nativeDistrict: "Moga", visaStatus: "Citizen", willingAbroad: "Yes",
  fatherOccupation: "Agriculture / farming", motherOccupation: "Teacher", brothers: 1, brothersMarried: 1, sisters: 0,
  sistersMarried: null, familyType: "Joint", familyValues: null, property: "12 acres in Moga",
  preference: {
    ageMin: 27, ageMax: 32, heightMinCm: 173, heightMaxCm: null, religions: ["Sikh"], castes: ["Jatt"], casteNoBar: false,
    maritalStatuses: ["NEVER_MARRIED"], countries: ["Canada", "India"], education: "Graduate", diet: null, notes: null,
  },
};

// Private fields as they exist on the database row (extra properties the builder must ignore)
const privateFields = {
  fullName: "Simranjeet Kaur Gill", fatherName: "Gurdev Singh", motherName: "Harjinder Kaur", phone: "9876511111",
  altPhone: "9876522222", email: "family@example.com", address: "House 12, Model Town", contactName: "Gurdev Singh",
  employer: "Infosys Mohali", nativePlace: "Dharamkot",
};

const opts = readBiodataOptions({});

describe("buildBiodata", () => {
  it("never includes names, parents' names, phones, email, address, employer or village", () => {
    for (const lang of ["en", "pa"] as const) {
      const out = JSON.stringify(buildBiodata({ ...base, ...privateFields } as BiodataProfile, opts, lang, now));
      for (const secret of Object.values(privateFields)) expect(out).not.toContain(secret);
      expect(out).toContain("PM1042");
    }
  });

  it("builds English content with age and height", () => {
    const b = buildBiodata(base, opts, "en", now);
    expect(b.title).toBe("Bride's Biodata");
    expect(b.summary).toMatch(/^29 years · 5'4" · Sikh · Jatt · MBA · Mohali$/);
    const basic = b.sections.find((s) => s.key === "basic")!;
    expect(basic.rows).toContainEqual(["Date of birth", "15 August 1997"]);
    expect(basic.rows).toContainEqual(["Height", `5'4" (163 cm)`]);
    // visa status is only shown for people living abroad
    expect(JSON.stringify(b)).not.toContain("Citizen");
  });

  it("translates labels and common values to Punjabi, gender-aware", () => {
    const b = buildBiodata(base, opts, "pa", now);
    expect(b.title).toBe("ਲੜਕੀ ਦਾ ਬਾਇਓਡਾਟਾ");
    const flat = JSON.stringify(b);
    expect(flat).toContain("ਜਨਮ ਮਿਤੀ");
    expect(flat).toContain("15-08-1997");
    expect(flat).toContain("ਸਿੱਖ");
    expect(flat).toContain("ਜੱਟ");
    expect(flat).toContain("ਅਣਵਿਆਹੀ"); // never married, female form
    expect(flat).toContain("ਕੈਨੇਡਾ, ਭਾਰਤ"); // preference countries list
    expect(flat).toContain("MBA"); // unknown values stay as typed
  });

  it("respects the owner's section choices and skips empty sections", () => {
    const b = buildBiodata(base, { ...opts, sections: ["basic", "horoscope", "property"] }, "en", now);
    expect(b.sections.map((s) => s.key)).toEqual(["basic", "horoscope", "property"]);
    const noHoroscope = buildBiodata({ ...base, birthTime: null, birthPlace: null }, opts, "en", now);
    expect(noHoroscope.sections.some((s) => s.key === "horoscope")).toBe(false);
  });
});
