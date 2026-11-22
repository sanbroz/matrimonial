import { GENDER_LABELS, MARITAL_LABELS } from "./profile-fields";

export function formatHeight(cm: number | null | undefined): string {
  if (!cm) return "";
  const totalIn = Math.round(cm / 2.54);
  return `${Math.floor(totalIn / 12)}'${totalIn % 12}" (${cm} cm)`;
}

/** Age in whole years; DOB is a date-only value stored at 00:00 UTC. */
/**
 * "Now" shifted to India time, for comparisons by UTC date parts against date-only values.
 * (Between 00:00 and 05:30 IST the UTC date is still yesterday.)
 */
export const nowIST = () => new Date(Date.now() + 330 * 60000);

/** Day of a timestamp in India time, e.g. "22 Nov 2026". */
export function formatDayIST(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

export function ageFrom(dob: Date | null | undefined, now = nowIST()): number | null {
  if (!dob) return null;
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

/** Date-only values (DOB): always format in UTC so the day never shifts. */
export function formatDateOnly(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

/** yyyy-mm-dd for <input type="date">, from a date-only value. */
export function toDateInput(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

/** Timestamps (notes, follow-ups): show in Indian time. */
export function formatDateTime(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

/** yyyy-mm-ddThh:mm in IST for <input type="datetime-local">. */
export function toDateTimeInputIST(d: Date | null | undefined): string {
  if (!d) return "";
  const ist = new Date(d.getTime() + 330 * 60000);
  return ist.toISOString().slice(0, 16);
}

/** Parse <input type="datetime-local"> value as IST. */
export function fromDateTimeInputIST(s: string): Date | null {
  if (!s) return null;
  const d = new Date(`${s}:00+05:30`);
  return isNaN(d.getTime()) ? null : d;
}

export function formatMoney(n: number | null | undefined): string {
  if (n == null) return "";
  return `₹${n.toLocaleString("en-IN")}`;
}

export const genderLabel = (g: keyof typeof GENDER_LABELS) => (g === "MALE" ? "Groom" : "Bride");
export const maritalLabel = (m: keyof typeof MARITAL_LABELS) => MARITAL_LABELS[m];
