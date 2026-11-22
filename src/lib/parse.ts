/**
 * Lenient parsers shared by the staff forms and the Excel/CSV import.
 * Each returns `null` for an empty value and throws ParseError for bad input.
 */

export class ParseError extends Error {}

const clean = (s: unknown) => (s == null ? "" : String(s).trim());

export function parseText(raw: unknown): string | null {
  const s = clean(raw).replace(/\s+/g, " ");
  return s === "" ? null : s;
}

export function parseMultiline(raw: unknown): string | null {
  const s = clean(raw);
  return s === "" ? null : s;
}

export function parseIntLoose(raw: unknown): number | null {
  const s = clean(raw).replace(/[,₹\s]/g, "");
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) throw new ParseError(`"${clean(raw)}" is not a number`);
  return Math.round(n);
}

export function parseBool(raw: unknown): boolean {
  const s = clean(raw).toLowerCase();
  return ["1", "true", "yes", "y", "on", "haan", "ha"].includes(s);
}

/**
 * Dates are DAY-FIRST (Indian convention): 15/08/1995, 15-8-95, 15.08.1995.
 * ISO (1995-08-15) and Excel serial numbers / Date objects are also accepted.
 * Returns a Date at 00:00 UTC (stored in a date-only column).
 */
export function parseDateLoose(raw: unknown): Date | null {
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) throw new ParseError("Invalid date");
    return utcDate(raw.getUTCFullYear(), raw.getUTCMonth() + 1, raw.getUTCDate());
  }
  const s = clean(raw);
  if (s === "") return null;

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return utcDate(+m[1], +m[2], +m[3], s);

  m = s.match(/^(\d{1,2})[\/\-. ](\d{1,2})[\/\-. ](\d{2,4})$/);
  if (m) {
    let year = +m[3];
    if (m[3].length === 2) year += year > 30 ? 1900 : 2000;
    return utcDate(year, +m[2], +m[1], s);
  }

  // "15 Aug 1995" / "15 August 1995"
  m = s.match(/^(\d{1,2})[\s\-]+([A-Za-z]{3,})[\s\-,]+(\d{4})$/);
  if (m) {
    const month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
    if (month > 0) return utcDate(+m[3], month, +m[1], s);
  }

  // Excel serial date (days since 1899-12-30)
  if (/^\d{4,5}(\.\d+)?$/.test(s)) {
    const n = Math.floor(Number(s));
    if (n > 10000 && n < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
      return utcDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
  }
  throw new ParseError(`"${s}" is not a date (use DD/MM/YYYY)`);
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function utcDate(y: number, mo: number, d: number, original?: string): Date {
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== mo - 1 ||
    date.getUTCDate() !== d ||
    y < 1900 ||
    y > 2100
  ) {
    throw new ParseError(`"${original ?? `${d}/${mo}/${y}`}" is not a valid date`);
  }
  return date;
}

/**
 * Height → centimetres. Accepts 5'6", 5' 6, 5 ft 6 in, 5.6 (feet.inches),
 * 5-6, 168 cm, 168, 1.68 m.
 */
export function parseHeightCm(raw: unknown): number | null {
  const s = clean(raw).toLowerCase().replace(/[’`´]/g, "'").replace(/[”“]/g, '"').replace("''", '"');
  if (s === "") return null;

  let m = s.match(/^(\d)\s*(?:'|ft|feet|foot)\s*(\d{1,2})?\s*(?:"|in|inch|inches)?$/);
  if (m) return feetInches(+m[1], m[2] ? +m[2] : 0, s);

  m = s.match(/^(\d)\s*[.\-\s]\s*(\d{1,2})$/);
  if (m) return feetInches(+m[1], +m[2], s);

  m = s.match(/^(\d(?:\.\d+)?)\s*m$/);
  if (m) return checkCm(Math.round(Number(m[1]) * 100), s);

  m = s.match(/^(\d{3})(?:\.\d+)?\s*(?:cm|cms)?$/);
  if (m) return checkCm(+m[1], s);

  m = s.match(/^(\d)$/);
  if (m) return feetInches(+m[1], 0, s);

  throw new ParseError(`"${clean(raw)}" is not a height (use 5'6" or cm)`);
}

function feetInches(ft: number, inch: number, s: string) {
  if (inch > 11) throw new ParseError(`"${s}" is not a valid height`);
  return checkCm(Math.round((ft * 12 + inch) * 2.54), s);
}

function checkCm(cm: number, s: string) {
  if (cm < 100 || cm > 230) throw new ParseError(`"${s}" is out of range for a height`);
  return cm;
}

export function parseGender(raw: unknown): "MALE" | "FEMALE" | null {
  const s = clean(raw).toLowerCase();
  if (s === "") return null;
  if (["m", "male", "boy", "groom", "son", "ladka", "munda", "man"].includes(s)) return "MALE";
  if (["f", "female", "girl", "bride", "daughter", "ladki", "kudi", "woman"].includes(s)) return "FEMALE";
  throw new ParseError(`"${clean(raw)}" is not a gender (use Male/Female)`);
}

export type MaritalStatusValue =
  | "NEVER_MARRIED"
  | "DIVORCED"
  | "AWAITING_DIVORCE"
  | "WIDOWED"
  | "ANNULLED";

export function parseMaritalStatus(raw: unknown): MaritalStatusValue | null {
  const s = clean(raw).toLowerCase().replace(/[_\-]/g, " ");
  if (s === "") return null;
  if (/^(never|unmarried|single|first|no|kunwara|kuwara)/.test(s)) return "NEVER_MARRIED";
  if (/await|pending|in process|separated/.test(s)) return "AWAITING_DIVORCE";
  if (/divorc/.test(s)) return "DIVORCED";
  if (/widow/.test(s)) return "WIDOWED";
  if (/annul/.test(s)) return "ANNULLED";
  throw new ParseError(`"${clean(raw)}" is not a marital status`);
}

/**
 * Comma / semicolon / pipe separated list → trimmed unique values. Not slashes: options such as
 * "Bania / Aggarwal" or "B.Tech / B.E." are one value.
 */
export function parseList(raw: unknown): string[] {
  const s = clean(raw);
  if (s === "") return [];
  return [...new Set(s.split(/[,;|]/).map((x) => x.trim()).filter(Boolean))];
}

/** Indian phone numbers: keep digits and a leading +, strip a 0/91 prefix for matching. */
export function normalisePhone(raw: unknown): string | null {
  const s = clean(raw);
  if (s === "") return null;
  const plus = s.startsWith("+");
  const digits = s.replace(/\D/g, "");
  if (digits.length < 7) throw new ParseError(`"${s}" is not a phone number`);
  return plus ? `+${digits}` : digits;
}

/** Last 10 digits — used to detect duplicates across formats (+91…, 0…, plain). */
export function phoneKey(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits || null;
}
