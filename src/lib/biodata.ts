/**
 * Builds biodata content from a profile. Pure function (unit-tested).
 *
 * PRIVACY: the biodata is shared outside the bureau, so it NEVER includes parents' names,
 * phone numbers, email, address, contact person, employer or native village. The candidate's
 * own name only appears when the bureau chooses it (options.showName); otherwise only the
 * profile code identifies the person.
 */
import type { BiodataOptions, BiodataSection } from "./biodata-options";
import { maritalText, t, tv, type Lang, type LabelKey } from "./biodata-i18n";

export interface BiodataProfile {
  code: string;
  /** Only used when options.showName is "first" / "full" */
  fullName?: string | null;
  gender: "MALE" | "FEMALE";
  dob: Date | null;
  birthTime: string | null;
  birthPlace: string | null;
  heightCm: number | null;
  weightKg: number | null;
  complexion: string | null;
  bodyType: string | null;
  maritalStatus: string;
  childrenCount: number;
  childrenLivingWith: string | null;
  disability: string | null;
  diet: string | null;
  smoking: string | null;
  drinking: string | null;
  motherTongue: string | null;
  about: string | null;
  religion: string | null;
  caste: string | null;
  subCaste: string | null;
  gotraSelf: string | null;
  gotraMother: string | null;
  gotraGrandmother: string | null;
  sikhStatus: string | null;
  manglik: string | null;
  rashi: string | null;
  nakshatra: string | null;
  education: string | null;
  educationDetail: string | null;
  profession: string | null;
  annualIncome: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  nativeDistrict: string | null;
  visaStatus: string | null;
  willingAbroad: string | null;
  fatherOccupation: string | null;
  motherOccupation: string | null;
  brothers: number | null;
  brothersMarried: number | null;
  sisters: number | null;
  sistersMarried: number | null;
  familyType: string | null;
  familyValues: string | null;
  property: string | null;
  preference: {
    ageMin: number | null;
    ageMax: number | null;
    heightMinCm: number | null;
    heightMaxCm: number | null;
    religions: string[];
    castes: string[];
    casteNoBar: boolean;
    maritalStatuses: string[];
    countries: string[];
    education: string | null;
    diet: string | null;
    notes: string | null;
  } | null;
}

export type Row = [label: string, value: string];
export interface BiodataSectionOut {
  key: BiodataSection;
  title: string;
  rows: Row[];
  /** Field key of each row (same order as rows), for compact layouts that pick fields */
  keys?: LabelKey[];
  text?: string;
}
export interface BiodataContent {
  lang: Lang;
  title: string;
  code: string;
  codeLabel: string;
  summary: string;
  sections: BiodataSectionOut[];
  contactLabel: string;
  /** The candidate's name when the bureau shares names (else null) */
  name: string | null;
  /** Included values by field key (only from the sections being shared), e.g. facts.age */
  facts: Partial<Record<LabelKey, string>>;
}

function heightText(cm: number | null, lang: Lang) {
  if (!cm) return "";
  const inches = Math.round(cm / 2.54);
  return `${Math.floor(inches / 12)}'${inches % 12}" (${cm} ${lang === "pa" ? "ਸੈ.ਮੀ." : "cm"})`;
}

function ageOn(dob: Date | null, now: Date) {
  if (!dob) return null;
  let a = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) a--;
  return a;
}

function dateText(d: Date | null, lang: Lang) {
  if (!d) return "";
  if (lang === "pa") {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getUTCDate())}-${p(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;
  }
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** "Harpreet Kaur Sandhu" → first: "Harpreet", full: as is. */
export function nameFor(fullName: string | null | undefined, mode: "none" | "first" | "full" | undefined): string | null {
  const n = fullName?.trim().replace(/\s+/g, " ");
  if (!n || !mode || mode === "none") return null;
  return mode === "first" ? n.split(" ")[0] : n;
}

const join = (...parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(", ");

export function buildBiodata(p: BiodataProfile, opts: BiodataOptions, lang: Lang, now = new Date()): BiodataContent {
  const L = (k: LabelKey) => t(k, lang);
  const v = (x: string | null | undefined) => tv(x, lang);
  const age = ageOn(p.dob, now);
  const keep = (pairs: [LabelKey, string | null | undefined | false][]) =>
    pairs.filter(([, val]) => val !== null && val !== undefined && val !== false && String(val).trim() !== "") as [LabelKey, string][];
  const rows = (pairs: [LabelKey, string | null | undefined | false][]): Row[] => keep(pairs).map(([k, val]) => [L(k), String(val)]);
  const both = (pairs: [LabelKey, string | null | undefined | false][]) => ({ rows: rows(pairs), keys: keep(pairs).map(([k]) => k) });

  const count = (n: number | null, married: number | null) =>
    n == null ? null : `${n}${married ? ` (${married} ${L("married")})` : ""}`;

  const all: Record<BiodataSection, () => BiodataSectionOut | null> = {
    photo: () => null, // rendered separately
    basic: () => ({
      key: "basic",
      title: L("basic"),
      ...both([
        ["dob", dateText(p.dob, lang)],
        ["age", age != null ? `${age} ${L("years")}` : null],
        ["height", heightText(p.heightCm, lang)],
        ["weight", p.weightKg ? `${p.weightKg} kg` : null],
        ["complexion", v(p.complexion)],
        ["bodyType", v(p.bodyType)],
        ["maritalStatus", maritalText(p.maritalStatus, lang, p.gender)],
        ["children", p.maritalStatus !== "NEVER_MARRIED" ? `${p.childrenCount}${p.childrenLivingWith ? ` (${p.childrenLivingWith})` : ""}` : null],
        ["diet", v(p.diet)],
        ["smoking", v(p.smoking)],
        ["drinking", v(p.drinking)],
        ["motherTongue", v(p.motherTongue)],
        ["disability", p.disability],
      ]),
    }),
    religion: () => ({
      key: "religion",
      title: L("religion"),
      ...both([
        ["religionField", v(p.religion)],
        ["caste", join(v(p.caste), p.subCaste)],
        ["sikhStatus", v(p.sikhStatus)],
        ["gotraSelf", p.gotraSelf],
        ["gotraMother", p.gotraMother],
        ["gotraGrandmother", p.gotraGrandmother],
      ]),
    }),
    horoscope: () => ({
      key: "horoscope",
      title: L("horoscope"),
      ...both([
        ["birthTime", p.birthTime],
        ["birthPlace", v(p.birthPlace)],
        ["manglik", v(p.manglik)],
        ["rashi", p.rashi],
        ["nakshatra", p.nakshatra],
      ]),
    }),
    career: () => ({
      key: "career",
      title: L("career"),
      ...both([
        ["education", join(v(p.education), p.educationDetail)],
        ["profession", v(p.profession)],
        ["income", p.annualIncome],
      ]),
    }),
    location: () => ({
      key: "location",
      title: L("location"),
      ...both([
        ["livesIn", join(v(p.city), v(p.state), v(p.country))],
        ["nativeDistrict", v(p.nativeDistrict)],
        ["visaStatus", p.country && p.country.toLowerCase() !== "india" ? v(p.visaStatus) : null],
        ["willingAbroad", v(p.willingAbroad)],
      ]),
    }),
    family: () => ({
      key: "family",
      title: L("family"),
      ...both([
        ["father", v(p.fatherOccupation)],
        ["mother", v(p.motherOccupation)],
        ["brothers", count(p.brothers, p.brothersMarried)],
        ["sisters", count(p.sisters, p.sistersMarried)],
        ["familyType", v(p.familyType)],
        ["familyValues", v(p.familyValues)],
      ]),
    }),
    property: () => (p.property ? { key: "property", title: L("property"), rows: [], text: p.property } : null),
    preference: () => {
      const pr = p.preference;
      if (!pr) return null;
      const range = (a: string, b: string) => (a || b ? `${a || "?"} – ${b || "?"}` : null);
      return {
        key: "preference",
        title: L("preference"),
        ...both([
          ["prefAge", range(pr.ageMin ? String(pr.ageMin) : "", pr.ageMax ? `${pr.ageMax} ${L("years")}` : "")],
          ["prefHeight", range(heightText(pr.heightMinCm, lang).split(" ")[0], heightText(pr.heightMaxCm, lang).split(" ")[0])],
          ["prefReligion", pr.religions.map(v).join(", ")],
          ["prefCaste", pr.casteNoBar ? L("casteNoBar") : pr.castes.map(v).join(", ")],
          ["prefMarital", pr.maritalStatuses.map((m) => maritalText(m, lang, p.gender === "MALE" ? "FEMALE" : "MALE")).join(", ")],
          ["prefCountry", pr.countries.map(v).join(", ")],
          ["prefEducation", pr.education ? `${L("atLeast")} ${v(pr.education)}` : null],
          ["prefDiet", v(pr.diet)],
          ["prefOther", pr.notes],
        ]),
      };
    },
    about: () => (p.about ? { key: "about", title: L("about"), rows: [], text: p.about } : null),
  };

  const order: BiodataSection[] = ["about", "basic", "religion", "horoscope", "career", "location", "family", "property", "preference"];
  const sections = order
    .filter((k) => opts.sections.includes(k))
    .map((k) => all[k]())
    .filter((s): s is BiodataSectionOut => !!s && (s.rows.length > 0 || !!s.text));
  const facts: Partial<Record<LabelKey, string>> = {};
  for (const sec of sections) sec.keys?.forEach((k, i) => (facts[k] = sec.rows[i][1]));
  const has = (k: BiodataSection) => opts.sections.includes(k);
  const place = p.country && p.country.toLowerCase() !== "india" ? p.country : p.city;

  return {
    lang,
    title: L(p.gender === "FEMALE" ? "brideBiodata" : "groomBiodata"),
    code: p.code,
    codeLabel: L("profileCode"),
    // Only details from the sections being shared (sharing "basic only" must not leak caste etc. here)
    summary: [
      has("basic") && age != null ? `${age} ${L("years")}` : null,
      (has("basic") && heightText(p.heightCm, lang).split(" ")[0]) || null,
      (has("religion") && v(p.religion)) || null,
      (has("religion") && v(p.caste)) || null,
      (has("career") && v(p.education)) || null,
      (has("location") && v(place)) || null,
    ]
      .filter(Boolean)
      .join(" · "),
    sections,
    contactLabel: L("contact"),
    name: nameFor(p.fullName, opts.showName),
    facts,
  };
}
