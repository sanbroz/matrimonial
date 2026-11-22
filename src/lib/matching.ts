/**
 * Match suggestion engine — pure functions, no database access (unit-tested).
 *
 * 1. Hard rules exclude a candidate: opposite gender, partner preferences that are
 *    "must-haves" (age, height, religion, castes, marital status, country), checked
 *    in BOTH directions by default, and the gotra rule.
 * 2. Everything else adjusts a 0–100 score with human-readable reasons.
 * Missing data never excludes anyone; it is flagged ("age not recorded") instead.
 */
import { z } from "zod";

export type Gender = "MALE" | "FEMALE";

export interface MatchPref {
  ageMin: number | null;
  ageMax: number | null;
  heightMinCm: number | null;
  heightMaxCm: number | null;
  religions: string[];
  castes: string[];
  excludeCastes: string[];
  casteNoBar: boolean;
  maritalStatuses: string[];
  manglik: string | null;
  countries: string[];
  education: string | null;
  minIncome: string | null;
  diet: string | null;
}

export interface MatchProfile {
  id: string;
  gender: Gender;
  dob: Date | null;
  heightCm: number | null;
  maritalStatus: string;
  religion: string | null;
  caste: string | null;
  gotraSelf: string | null;
  gotraMother: string | null;
  gotraGrandmother: string | null;
  manglik: string | null;
  education: string | null;
  annualIncome: string | null;
  diet: string | null;
  country: string | null;
  city: string | null;
  nativeDistrict: string | null;
  hasPhoto: boolean;
  urgent: boolean;
  preference: MatchPref | null;
}

export const matchingOptionsSchema = z.object({
  /** all = none of the recorded gotras (self, mother, dadi) may coincide; self = only own gotra; off */
  gotraRule: z.enum(["all", "self", "off"]).catch("all"),
  /** Also require that the client fits the candidate's preferences. */
  twoWay: z.boolean().catch(true),
  /** Include profiles that are "On hold". */
  includeOnHold: z.boolean().catch(false),
  /** Treat preferred castes as a must-have (otherwise only a score boost). */
  strictCastes: z.boolean().catch(true),
  /** Treat preferred countries as a must-have (otherwise only a score boost). */
  strictCountries: z.boolean().catch(false),
});
export type MatchingOptions = z.infer<typeof matchingOptionsSchema>;
export const readMatchingOptions = (json: unknown): MatchingOptions => matchingOptionsSchema.parse(json ?? {});

export interface MatchContext {
  now: Date;
  /** Option lists in ascending order, used to compare "at least" preferences. */
  educationOrder: string[];
  incomeOrder: string[];
}

export interface MatchResult {
  candidateId: string;
  excluded: string[]; // reasons this candidate is ruled out (empty = suggested)
  score: number;
  good: string[];
  warnings: string[];
}

// ───────────── helpers ─────────────

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9਀-੿]/g, "");
const eq = (a: string | null | undefined, b: string | null | undefined) => !!norm(a) && norm(a) === norm(b);
const inList = (v: string | null | undefined, list: string[]) => list.some((x) => eq(x, v));

export function ageOn(dob: Date | null, now: Date): number | null {
  if (!dob) return null;
  let a = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) a--;
  return a;
}

/** Normalised manglik: yes / no / partial / null (unknown). */
export function manglikOf(v: string | null | undefined): "yes" | "no" | "partial" | null {
  const s = norm(v);
  if (!s || s.startsWith("dont") || s.includes("know") || s === "any" || s.includes("doesnt")) return null;
  if (s.startsWith("anshik") || s.includes("partial")) return "partial";
  if (s.startsWith("no") || s === "nonmanglik") return "no";
  if (s.startsWith("yes") || s === "manglik") return "yes";
  return null;
}

const MARITAL_TEXT: Record<string, string> = {
  NEVER_MARRIED: "never married",
  DIVORCED: "divorced",
  AWAITING_DIVORCE: "awaiting divorce",
  WIDOWED: "widowed",
  ANNULLED: "annulled",
};

/** Gotras that count for the rule. */
function gotras(p: MatchProfile, rule: MatchingOptions["gotraRule"]): string[] {
  const list = rule === "self" ? [p.gotraSelf] : [p.gotraSelf, p.gotraMother, p.gotraGrandmother];
  return list.map(norm).filter(Boolean);
}

export function gotraClash(a: MatchProfile, b: MatchProfile, rule: MatchingOptions["gotraRule"]): string | null {
  if (rule === "off") return null;
  const ga = gotras(a, rule);
  const gb = new Set(gotras(b, rule));
  const hit = ga.find((g) => gb.has(g));
  if (!hit) return null;
  const label = [a.gotraSelf, a.gotraMother, a.gotraGrandmother].find((g) => norm(g) === hit) ?? hit;
  return `Same gotra (${label})`;
}

/**
 * Does `who` satisfy `pref` (the must-have parts)?
 * Returns failures (exclude) and unknowns (data missing, flagged only).
 */
export function checkPreference(
  pref: MatchPref | null,
  who: MatchProfile,
  opts: MatchingOptions,
  now: Date,
): { fail: string[]; unknown: string[] } {
  const fail: string[] = [];
  const unknown: string[] = [];
  if (!pref) return { fail, unknown };

  if (pref.ageMin != null || pref.ageMax != null) {
    const age = ageOn(who.dob, now);
    if (age == null) unknown.push("age");
    else if ((pref.ageMin != null && age < pref.ageMin) || (pref.ageMax != null && age > pref.ageMax))
      fail.push(`age ${age} is outside ${pref.ageMin ?? "?"}–${pref.ageMax ?? "?"}`);
  }
  if (pref.heightMinCm != null || pref.heightMaxCm != null) {
    const h = who.heightCm;
    if (h == null) unknown.push("height");
    else if ((pref.heightMinCm != null && h < pref.heightMinCm) || (pref.heightMaxCm != null && h > pref.heightMaxCm))
      fail.push(`height ${h} cm is outside the range`);
  }
  if (pref.religions.length) {
    if (!who.religion) unknown.push("religion");
    else if (!inList(who.religion, pref.religions)) fail.push(`religion ${who.religion} not wanted`);
  }
  if (who.caste && inList(who.caste, pref.excludeCastes)) fail.push(`caste ${who.caste} is excluded`);
  if (opts.strictCastes && !pref.casteNoBar && pref.castes.length) {
    if (!who.caste) unknown.push("caste");
    else if (!inList(who.caste, pref.castes)) fail.push(`caste ${who.caste} not in preferred castes`);
  }
  if (pref.maritalStatuses.length && !pref.maritalStatuses.includes(who.maritalStatus)) {
    fail.push(`${MARITAL_TEXT[who.maritalStatus] ?? who.maritalStatus} not acceptable`);
  }
  if (opts.strictCountries && pref.countries.length) {
    if (!who.country) unknown.push("country");
    else if (!inList(who.country, pref.countries)) fail.push(`lives in ${who.country}, not a preferred country`);
  }
  return { fail, unknown };
}

/** Index in an ordered (lowest → highest) option list, or -1. "Other" has no rank. */
const rank = (v: string | null | undefined, order: string[]) =>
  /^other$/i.test((v ?? "").trim()) ? -1 : order.findIndex((x) => eq(x, v));

// ───────────── main ─────────────

/** Evaluate candidate `b` for client `a`. */
export function evaluateMatch(a: MatchProfile, b: MatchProfile, opts: MatchingOptions, ctx: MatchContext): MatchResult {
  const excluded: string[] = [];
  const good: string[] = [];
  const warnings: string[] = [];
  let score = 50;

  if (a.id === b.id || a.gender === b.gender) excluded.push("Same gender");

  const clash = gotraClash(a, b, opts.gotraRule);
  if (clash) excluded.push(clash);

  const ours = checkPreference(a.preference, b, opts, ctx.now);
  excluded.push(...ours.fail.map((f) => `Your preference: ${f}`));
  if (opts.twoWay) {
    const theirs = checkPreference(b.preference, a, opts, ctx.now);
    excluded.push(...theirs.fail.map((f) => `Their preference: ${f}`));
    if (theirs.unknown.length) {
      warnings.push(`Their preference can't be checked: client's ${theirs.unknown.join(", ")} not recorded`);
      score -= 2 * theirs.unknown.length;
    }
  }
  if (ours.unknown.length) {
    warnings.push(`${ours.unknown.join(", ")} not recorded`);
    score -= 3 * ours.unknown.length;
  }

  // ── soft factors ──
  const pa = a.preference;
  const groom = a.gender === "MALE" ? a : b;
  const bride = a.gender === "MALE" ? b : a;

  const ageG = ageOn(groom.dob, ctx.now);
  const ageB = ageOn(bride.dob, ctx.now);
  if (ageG != null && ageB != null) {
    const gap = ageG - ageB;
    if (gap >= 0 && gap <= 6) { score += 6; good.push(`Age gap ${gap} yr${gap === 1 ? "" : "s"}`); }
    else if (gap > 6 && gap <= 10) { score -= 2; warnings.push(`Age gap ${gap} years`); }
    else if (gap > 10) { score -= 8; warnings.push(`Large age gap (${gap} years)`); }
    else if (gap < -1) { score -= 5; warnings.push(`Bride is ${-gap} years older`); }
  }

  if (groom.heightCm && bride.heightCm) {
    if (groom.heightCm >= bride.heightCm + 5) { score += 3; }
    else if (groom.heightCm < bride.heightCm) { score -= 4; warnings.push("Bride is taller"); }
  }

  if (eq(a.religion, b.religion)) { score += 5; good.push(`Both ${b.religion}`); }
  if (eq(a.caste, b.caste)) { score += 5; good.push(`Same caste (${b.caste})`); }
  else if (pa && pa.castes.length && !opts.strictCastes && !pa.casteNoBar) {
    if (inList(b.caste, pa.castes)) { score += 5; good.push(`Preferred caste (${b.caste})`); }
    else { score -= 4; warnings.push("Not a preferred caste"); }
  }

  // Manglik compatibility: a manglik should ideally marry a manglik.
  const ma = manglikOf(a.manglik);
  const mb = manglikOf(b.manglik);
  const wantM = manglikOf(pa?.manglik);
  if (wantM === "no" && mb === "yes") { score -= 10; warnings.push("Candidate is manglik"); }
  else if (wantM === "yes" && mb === "no") { score -= 6; warnings.push("Candidate is not manglik"); }
  else if (ma && mb) {
    if ((ma === "yes") !== (mb === "yes")) { score -= 6; warnings.push("Manglik mismatch"); }
    else { score += 3; good.push(ma === "yes" ? "Both manglik" : "Manglik compatible"); }
  }

  if (pa?.education) {
    const want = rank(pa.education, ctx.educationOrder);
    const have = rank(b.education, ctx.educationOrder);
    if (want >= 0 && have >= 0) {
      if (have >= want) { score += 5; good.push(`Education: ${b.education}`); }
      else { score -= 4; warnings.push(`Education below preference (${b.education})`); }
    }
  }

  if (pa?.minIncome) {
    const want = rank(pa.minIncome, ctx.incomeOrder);
    const have = rank(b.annualIncome, ctx.incomeOrder);
    if (want >= 0 && have >= 0) {
      if (have >= want) { score += 5; good.push(`Income: ${b.annualIncome}`); }
      else { score -= 4; warnings.push(`Income below preference (${b.annualIncome})`); }
    } else if (want >= 0 && !b.annualIncome) {
      warnings.push("Income not recorded");
    }
  }

  if (pa?.diet && b.diet) {
    if (eq(pa.diet, b.diet)) { score += 4; good.push(`Diet: ${b.diet}`); }
    else if (/^veg/i.test(pa.diet) && /non/i.test(b.diet)) { score -= 6; warnings.push(`Diet: ${b.diet}`); }
  }

  if (pa && pa.countries.length && !opts.strictCountries) {
    if (inList(b.country, pa.countries)) { score += 6; good.push(`Lives in ${b.country}`); }
    else if (b.country) { score -= 3; warnings.push(`Lives in ${b.country}`); }
  } else if (eq(a.country, b.country) && norm(a.country) !== "india") {
    score += 5; good.push(`Both in ${b.country}`);
  }
  if (eq(a.nativeDistrict, b.nativeDistrict)) { score += 2; good.push(`Same district (${b.nativeDistrict})`); }
  else if (eq(a.city, b.city)) { score += 2; good.push(`Same city (${b.city})`); }

  if (b.hasPhoto) score += 3; else warnings.push("No photo");
  if (b.urgent) score += 2;

  return { candidateId: b.id, excluded, score: Math.max(0, Math.min(100, score)), good, warnings };
}

/** Evaluate all candidates; suggested first by score, then excluded. */
export function rankCandidates(a: MatchProfile, pool: MatchProfile[], opts: MatchingOptions, ctx: MatchContext) {
  const results = pool.map((b) => evaluateMatch(a, b, opts, ctx));
  const suggested = results.filter((r) => r.excluded.length === 0).sort((x, y) => y.score - x.score);
  const excluded = results.filter((r) => r.excluded.length > 0);
  return { suggested, excluded };
}
