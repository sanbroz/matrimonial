/**
 * Column-mapping helpers for the spreadsheet import. Pure functions, used by the
 * browser (preview) and the server (actual import) so both validate identically.
 */
import { PROFILE_FIELDS, inputName, parseProfileValues, type FieldDef } from "./profile-fields";

/** Fields that can be imported (preferences included, prefixed "pref."). */
export const IMPORTABLE_FIELDS = PROFILE_FIELDS;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Best guess of the field for each column header; each field is used at most once. */
export function guessMapping(headers: string[]): (string | null)[] {
  const used = new Set<string>();
  return headers.map((h) => {
    const n = norm(h);
    if (!n) return null;
    const hit =
      // exact label / key / alias match first
      IMPORTABLE_FIELDS.find((f) => !used.has(inputName(f)) && !f.pref && [f.label, f.key, ...(f.aliases ?? [])].some((x) => norm(x) === n)) ??
      // then "header contains alias" for longer headers like "Mobile No. (Father)"
      IMPORTABLE_FIELDS.find(
        (f) => !used.has(inputName(f)) && !f.pref && (f.aliases ?? []).some((a) => norm(a).length >= 4 && n.includes(norm(a))),
      );
    if (!hit) return null;
    used.add(inputName(hit));
    return inputName(hit);
  });
}

export interface RowResult {
  rowNumber: number; // 1-based spreadsheet row (header = row 1)
  profile: Record<string, unknown>;
  preference: Record<string, unknown>;
  errors: string[];
}

export function mapRow(
  row: string[],
  mapping: (string | null)[],
  rowNumber: number,
  defaults: { gender?: "MALE" | "FEMALE" | "" } = {},
): RowResult {
  const byName = new Map<string, string[]>();
  mapping.forEach((name, col) => {
    if (!name) return;
    const v = (row[col] ?? "").trim();
    if (v === "") return;
    // Two columns mapped to "about" etc. are joined
    byName.set(name, [...(byName.get(name) ?? []), v]);
  });
  const parsed = parseProfileValues((name: string, f: FieldDef) => {
    const vals = byName.get(name);
    if (vals) return f.type === "textarea" ? vals.join("\n") : vals.join(", ");
    if (name === "gender" && defaults.gender) return defaults.gender;
    if (f.required) return ""; // triggers "is required"
    return undefined;
  });
  return {
    rowNumber,
    profile: parsed.profile,
    preference: parsed.preference,
    errors: Object.values(parsed.errors),
  };
}

export function isBlankRow(row: string[]) {
  return row.every((c) => (c ?? "").trim() === "");
}

/** Rows sent to the server per request (a big file is imported in steps, so no request runs too long). */
export const IMPORT_BATCH = 200;

/**
 * Same person without a phone match: same name (spacing / case / dots ignored) and same date of birth.
 * null when either is missing (then only the phone check applies).
 */
export function nameDobKey(name: unknown, dob: unknown): string | null {
  const n = typeof name === "string" ? name.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim() : "";
  const d = dob instanceof Date && !Number.isNaN(dob.getTime()) ? dob.toISOString().slice(0, 10) : "";
  return n && d ? `${n}|${d}` : null;
}
