/**
 * Sharing one or more biodatas: layout, which details to include, language. Pure (used by the
 * share page, the public link page and the client export code).
 */
import { BIODATA_SECTIONS, type BiodataSection } from "./biodata-options";
import type { LabelKey } from "./biodata-i18n";

export const LAYOUTS = {
  full: { label: "Full biodata", hint: "One A4 page per profile", perPage: 1 },
  two: { label: "2 per page", hint: "Photo and main details, two profiles on each page", perPage: 2 },
  cards: { label: "4 per page", hint: "Small cards with the key facts", perPage: 4 },
  list: { label: "List", hint: "A compact table, 8 profiles per page", perPage: 8 },
} as const;
export type Layout = keyof typeof LAYOUTS;

export const ALL_SECTIONS = Object.keys(BIODATA_SECTIONS) as BiodataSection[];

/** Quick choices for "how much to share". */
export const PRESETS: Record<string, { label: string; sections: BiodataSection[] }> = {
  full: { label: "Everything (biodata settings)", sections: [] }, // [] = the bureau's biodata settings
  basic: { label: "Basic info only", sections: ["photo", "basic", "religion", "career", "location"] },
  nophoto: { label: "No photos", sections: ["basic", "religion", "horoscope", "career", "location", "family", "preference", "about"] },
  minimal: { label: "Minimal (no photo, no family)", sections: ["basic", "religion", "career", "location"] },
};

export const SHARE_EXPIRY_DAYS = [3, 7, 14, 30] as const;
export const MAX_SHARE_PROFILES = 40;

export interface ShareOptions {
  layout: Layout;
  sections: BiodataSection[];
  lang: "en" | "pa";
}

/** From URL search params (or a stored link). Unknown values fall back to defaults. */
export function readShareOptions(
  input: { layout?: string | null; sections?: string[] | string | null; lang?: string | null; preset?: string | null },
  defaults: { sections: BiodataSection[]; lang: "en" | "pa" },
  count = 1,
): ShareOptions {
  const layout = (input.layout && input.layout in LAYOUTS ? input.layout : count > 1 ? "two" : "full") as Layout;
  let sections: BiodataSection[];
  const raw = Array.isArray(input.sections) ? input.sections : input.sections ? input.sections.split(",") : null;
  if (input.preset && PRESETS[input.preset]) {
    const p = PRESETS[input.preset].sections;
    sections = p.length ? p : defaults.sections;
  } else if (raw && raw.length) {
    sections = raw.filter((s): s is BiodataSection => (ALL_SECTIONS as string[]).includes(s));
  } else {
    sections = defaults.sections;
  }
  const lang = input.lang === "pa" || input.lang === "en" ? input.lang : defaults.lang;
  return { layout, sections: ALL_SECTIONS.filter((s) => sections.includes(s)), lang };
}

/** Which preset (if any) the chosen sections equal. */
export function presetOf(sections: BiodataSection[], defaults: BiodataSection[]): string | null {
  const same = (a: BiodataSection[], b: BiodataSection[]) => a.length === b.length && a.every((x) => b.includes(x));
  for (const [k, p] of Object.entries(PRESETS)) if (same(sections, p.sections.length ? p.sections : defaults)) return k;
  return null;
}

/** Fields shown on compact layouts, in order (only those included in the shared sections appear). */
export const CARD_FIELDS: LabelKey[] = [
  "age", "height", "maritalStatus", "religionField", "caste", "sikhStatus", "gotraSelf", "manglik",
  "education", "profession", "income", "livesIn", "visaStatus", "nativeDistrict", "diet", "father", "mother", "brothers", "sisters",
];
export const TWO_UP_FIELDS: LabelKey[] = [
  "age", "height", "maritalStatus", "children", "diet", "religionField", "caste", "sikhStatus", "gotraSelf", "manglik",
  "education", "profession", "income", "livesIn", "nativeDistrict", "visaStatus", "father", "mother", "brothers", "sisters",
];

export const chunk = <T,>(a: T[], n: number): T[][] => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
