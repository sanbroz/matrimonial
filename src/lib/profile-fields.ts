/**
 * One definition of every profile field. It drives:
 *  - the staff profile form (sections, inputs, dropdown suggestions)
 *  - server-side parsing/validation of that form
 *  - column mapping + parsing for Excel/CSV import
 */
import type { OptionCategory } from "./options-defaults";
import {
  ParseError,
  parseBool,
  parseDateLoose,
  parseGender,
  parseHeightCm,
  parseIntLoose,
  parseList,
  parseMaritalStatus,
  parseMultiline,
  parseText,
  normalisePhone,
} from "./parse";

export type FieldType =
  | "text"
  | "textarea"
  | "int"
  | "date"
  | "height"
  | "bool"
  | "gender"
  | "marital"
  | "phone"
  | "list"
  | "maritalList";

export type SectionKey =
  | "basic"
  | "religion"
  | "career"
  | "location"
  | "family"
  | "contact"
  | "preference";

export const SECTIONS: { key: SectionKey; title: string; hint?: string }[] = [
  { key: "basic", title: "Basic details" },
  { key: "religion", title: "Religion, community & horoscope" },
  { key: "career", title: "Education & career" },
  { key: "location", title: "Location & NRI status" },
  { key: "family", title: "Family" },
  {
    key: "contact",
    title: "Contact details",
    hint: "Internal only. These details never appear on a shared biodata.",
  },
  { key: "preference", title: "Partner preferences" },
];

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  section: SectionKey;
  required?: boolean;
  /** Customisable dropdown suggestions (Settings → Dropdown lists). */
  options?: OptionCategory;
  /** Fixed choices for a plain text field. */
  choices?: string[];
  placeholder?: string;
  /** Extra header names recognised when importing a spreadsheet. */
  aliases?: string[];
  /** Field belongs to PartnerPreference, not Profile. */
  pref?: boolean;
  wide?: boolean;
}

export const GENDER_LABELS = { MALE: "Male (groom)", FEMALE: "Female (bride)" } as const;

export const MARITAL_LABELS = {
  NEVER_MARRIED: "Never married",
  DIVORCED: "Divorced",
  AWAITING_DIVORCE: "Awaiting divorce",
  WIDOWED: "Widowed",
  ANNULLED: "Annulled",
} as const;

export const PROFILE_FIELDS: FieldDef[] = [
  // Basic
  { key: "fullName", label: "Full name", type: "text", section: "basic", required: true, aliases: ["name", "candidate name", "boy name", "girl name"] },
  { key: "gender", label: "Gender", type: "gender", section: "basic", required: true, aliases: ["sex", "boy/girl", "bride/groom"] },
  { key: "dob", label: "Date of birth", type: "date", section: "basic", aliases: ["dob", "birth date", "d.o.b", "date of birth"] },
  { key: "birthTime", label: "Birth time", type: "text", section: "basic", placeholder: "e.g. 6:45 AM", aliases: ["time of birth", "tob"] },
  { key: "birthPlace", label: "Birth place", type: "text", section: "basic", aliases: ["place of birth", "pob"] },
  { key: "heightCm", label: "Height", type: "height", section: "basic", aliases: ["height", "ht"] },
  { key: "weightKg", label: "Weight (kg)", type: "int", section: "basic", aliases: ["weight"] },
  { key: "complexion", label: "Complexion", type: "text", section: "basic", options: "complexion", aliases: ["colour", "color", "rang"] },
  { key: "bodyType", label: "Body type", type: "text", section: "basic", options: "bodyType" },
  { key: "maritalStatus", label: "Marital status", type: "marital", section: "basic", aliases: ["marital", "status"] },
  { key: "childrenCount", label: "Children", type: "int", section: "basic", aliases: ["kids", "no of children"] },
  { key: "childrenLivingWith", label: "Children living with", type: "text", section: "basic" },
  { key: "disability", label: "Disability / health", type: "text", section: "basic" },
  { key: "diet", label: "Diet", type: "text", section: "basic", options: "diet", aliases: ["food", "veg/non-veg"] },
  { key: "smoking", label: "Smoking", type: "text", section: "basic", options: "habit" },
  { key: "drinking", label: "Drinking", type: "text", section: "basic", options: "habit" },
  { key: "motherTongue", label: "Mother tongue", type: "text", section: "basic", options: "motherTongue" },
  { key: "about", label: "About / remarks for biodata", type: "textarea", section: "basic", wide: true, aliases: ["about", "remarks", "description"] },

  // Religion & horoscope
  { key: "religion", label: "Religion", type: "text", section: "religion", options: "religion", aliases: ["dharam", "dharm"] },
  { key: "caste", label: "Caste / community", type: "text", section: "religion", options: "caste", aliases: ["caste", "community", "jaati", "jati"] },
  { key: "subCaste", label: "Sub-caste", type: "text", section: "religion" },
  { key: "gotraSelf", label: "Gotra (self)", type: "text", section: "religion", options: "gotra", aliases: ["gotra", "gotar", "got"] },
  { key: "gotraMother", label: "Gotra (mother / nanke)", type: "text", section: "religion", options: "gotra", aliases: ["mother gotra", "nanka gotra", "maternal gotra"] },
  { key: "gotraGrandmother", label: "Gotra (dadi)", type: "text", section: "religion", options: "gotra", aliases: ["dadi gotra", "grandmother gotra"] },
  { key: "sikhStatus", label: "Sikh status", type: "text", section: "religion", options: "sikhStatus", aliases: ["amritdhari", "keshdhari", "turban"] },
  { key: "manglik", label: "Manglik", type: "text", section: "religion", options: "manglik" },
  { key: "rashi", label: "Rashi", type: "text", section: "religion", options: "rashi" },
  { key: "nakshatra", label: "Nakshatra", type: "text", section: "religion" },

  // Career
  { key: "education", label: "Highest education", type: "text", section: "career", options: "education", aliases: ["qualification", "edu"] },
  { key: "educationDetail", label: "Education details", type: "text", section: "career", placeholder: "College, specialisation" },
  { key: "profession", label: "Profession", type: "text", section: "career", options: "profession", aliases: ["occupation", "job", "work"] },
  { key: "employer", label: "Employer / business", type: "text", section: "career", aliases: ["company"] },
  { key: "annualIncome", label: "Annual income", type: "text", section: "career", options: "annualIncome", aliases: ["income", "salary", "package"] },

  // Location
  { key: "city", label: "Current city", type: "text", section: "location", aliases: ["city", "residence", "location"] },
  { key: "state", label: "State / province", type: "text", section: "location", options: "state" },
  { key: "country", label: "Country", type: "text", section: "location", options: "country" },
  { key: "nativePlace", label: "Native village / town", type: "text", section: "location", aliases: ["village", "pind", "native"] },
  { key: "nativeDistrict", label: "Native district", type: "text", section: "location", options: "district", aliases: ["district"] },
  { key: "visaStatus", label: "Visa / residency status", type: "text", section: "location", options: "visaStatus", aliases: ["visa", "pr", "nri status"] },
  { key: "willingAbroad", label: "Willing to settle abroad", type: "text", section: "location", choices: ["Yes", "No", "Maybe"] },

  // Family
  { key: "fatherName", label: "Father's name", type: "text", section: "family", aliases: ["father"] },
  { key: "fatherOccupation", label: "Father's occupation", type: "text", section: "family" },
  { key: "motherName", label: "Mother's name", type: "text", section: "family", aliases: ["mother"] },
  { key: "motherOccupation", label: "Mother's occupation", type: "text", section: "family" },
  { key: "brothers", label: "Brothers", type: "int", section: "family" },
  { key: "brothersMarried", label: "Brothers married", type: "int", section: "family" },
  { key: "sisters", label: "Sisters", type: "int", section: "family" },
  { key: "sistersMarried", label: "Sisters married", type: "int", section: "family" },
  { key: "familyType", label: "Family type", type: "text", section: "family", options: "familyType" },
  { key: "familyValues", label: "Family values", type: "text", section: "family", options: "familyValues" },
  { key: "property", label: "Property / land", type: "textarea", section: "family", aliases: ["land", "zameen", "acres"] },

  // Contact (internal)
  { key: "contactName", label: "Contact person", type: "text", section: "contact" },
  { key: "contactRelation", label: "Relation to candidate", type: "text", section: "contact", placeholder: "Father, mother, self…" },
  { key: "phone", label: "Phone", type: "phone", section: "contact", aliases: ["mobile", "contact", "contact no", "phone no", "mobile no", "number"] },
  { key: "altPhone", label: "Alternate phone", type: "phone", section: "contact", aliases: ["alternate", "phone 2", "whatsapp"] },
  { key: "email", label: "Email", type: "text", section: "contact" },
  { key: "address", label: "Address", type: "textarea", section: "contact", wide: true },

  // Partner preferences
  { key: "ageMin", label: "Age from", type: "int", section: "preference", pref: true },
  { key: "ageMax", label: "Age to", type: "int", section: "preference", pref: true },
  { key: "heightMinCm", label: "Height from", type: "height", section: "preference", pref: true },
  { key: "heightMaxCm", label: "Height to", type: "height", section: "preference", pref: true },
  { key: "religions", label: "Religions (comma separated)", type: "list", section: "preference", pref: true, options: "religion" },
  { key: "castes", label: "Preferred castes", type: "list", section: "preference", pref: true, options: "caste" },
  { key: "excludeCastes", label: "Castes to exclude", type: "list", section: "preference", pref: true, options: "caste" },
  { key: "casteNoBar", label: "Caste no bar", type: "bool", section: "preference", pref: true },
  { key: "maritalStatuses", label: "Acceptable marital status", type: "maritalList", section: "preference", pref: true, wide: true },
  { key: "manglik", label: "Manglik preference", type: "text", section: "preference", pref: true, options: "manglik" },
  { key: "countries", label: "Countries", type: "list", section: "preference", pref: true, options: "country" },
  { key: "education", label: "Minimum education", type: "text", section: "preference", pref: true, options: "education" },
  { key: "minIncome", label: "Minimum income", type: "text", section: "preference", pref: true, options: "annualIncome" },
  { key: "diet", label: "Diet preference", type: "text", section: "preference", pref: true, options: "diet" },
  { key: "notes", label: "Other preferences", type: "textarea", section: "preference", pref: true, wide: true },
];

/** Form input name — preference fields are prefixed to avoid clashing keys (education, diet…). */
export const inputName = (f: FieldDef) => (f.pref ? `pref.${f.key}` : f.key);

export function parseField(f: FieldDef, raw: unknown): unknown {
  switch (f.type) {
    case "text":
      return parseText(raw);
    case "textarea":
      return parseMultiline(raw);
    case "int":
      return parseIntLoose(raw);
    case "date":
      return parseDateLoose(raw);
    case "height":
      return parseHeightCm(raw);
    case "bool":
      return parseBool(raw);
    case "gender":
      return parseGender(raw);
    case "marital":
      return parseMaritalStatus(raw);
    case "phone":
      return normalisePhone(raw);
    case "list":
      return parseList(raw);
    case "maritalList":
      return (Array.isArray(raw) ? raw : parseList(raw))
        .map((v) => parseMaritalStatus(v))
        .filter((v): v is NonNullable<typeof v> => v != null);
  }
}

export interface ParsedProfile {
  profile: Record<string, unknown>;
  preference: Record<string, unknown>;
  errors: Record<string, string>;
}

/**
 * Parse values keyed by input name. `getValue` returns the raw value
 * (string, or string[] for maritalList) or undefined when the field was not supplied.
 * Fields that are not supplied are left out entirely (so partial imports don't wipe data).
 */
export function parseProfileValues(
  getValue: (name: string, f: FieldDef) => unknown,
  opts: { requireAll?: boolean } = {},
): ParsedProfile {
  const out: ParsedProfile = { profile: {}, preference: {}, errors: {} };
  for (const f of PROFILE_FIELDS) {
    const name = inputName(f);
    const raw = getValue(name, f);
    if (raw === undefined) {
      if (f.required && opts.requireAll) out.errors[name] = `${f.label} is required`;
      continue;
    }
    try {
      const value = parseField(f, raw);
      if (f.required && (value == null || value === "")) {
        out.errors[name] = `${f.label} is required`;
        continue;
      }
      (f.pref ? out.preference : out.profile)[f.key] = value;
    } catch (e) {
      out.errors[name] = e instanceof ParseError ? e.message : `Invalid ${f.label}`;
    }
  }
  // Integers stored as non-null with a default
  if (out.profile.childrenCount === null) out.profile.childrenCount = 0;
  if (out.profile.maritalStatus === null) delete out.profile.maritalStatus;
  return out;
}

/** Height dropdown options: 4'0" to 7'0". */
export const HEIGHT_OPTIONS = Array.from({ length: 37 }, (_, i) => {
  const inches = 48 + i;
  const cm = Math.round(inches * 2.54);
  return { cm, label: `${Math.floor(inches / 12)}'${inches % 12}" (${cm} cm)` };
});
