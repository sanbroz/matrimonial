/** Money helpers — pure functions (unit-tested). Amounts are whole rupees. */

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n];
  return [TENS[Math.floor(n / 10)], ONES[n % 10]].filter(Boolean).join(" ");
}

function belowThousand(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", rest ? belowHundred(rest) : ""].filter(Boolean).join(" ");
}

/** Indian numbering: 1,25,000 → "One Lakh Twenty Five Thousand". */
export function numberToIndianWords(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 1_00_00_000);
  n %= 1_00_00_000;
  const lakh = Math.floor(n / 1_00_000);
  n %= 1_00_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${numberToIndianWords(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (n) parts.push(belowThousand(n));
  return parts.join(" ");
}

/** For receipts: "Rupees Twelve Thousand Five Hundred Only". */
export const amountInWords = (n: number) => `Rupees ${numberToIndianWords(n)} Only`;

/** ₹1,25,000 */
export const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export interface PaymentLike {
  amount: number;
  voidedAt: Date | null;
}

export function paidTotal(payments: PaymentLike[]): number {
  return payments.filter((p) => !p.voidedAt).reduce((s, p) => s + p.amount, 0);
}

/** What is still owed on a due (never negative). */
export function dueBalance(due: { amount: number; status: string }, payments: PaymentLike[]): number {
  if (due.status === "WAIVED") return 0;
  return Math.max(0, due.amount - paidTotal(payments));
}

/** Status a due should have after payments change. */
export function dueStatusFor(due: { amount: number; status: string }, payments: PaymentLike[]): "OPEN" | "PAID" | "WAIVED" {
  if (due.status === "WAIVED") return "WAIVED";
  return paidTotal(payments) >= due.amount ? "PAID" : "OPEN";
}

/** Membership end date (date-only, UTC): a 180-day plan from 1 Jan ends 29 Jun (inclusive). */
export function membershipEnd(start: Date, durationDays: number): Date {
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + durationDays - 1));
}

/** Whole days from today (IST) until the end date; negative once expired. */
export function daysLeft(endDate: Date, now = new Date()): number {
  const ist = new Date(now.getTime() + 330 * 60000);
  const today = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  return Math.round((endDate.getTime() - today) / 86400000);
}

/** Today's date (IST) as a date-only UTC value. */
export function todayIST(now = new Date()): Date {
  const ist = new Date(now.getTime() + 330 * 60000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
}

export const KIND_LABELS = {
  REGISTRATION: "Registration fee",
  MEMBERSHIP: "Membership",
  SUCCESS_FEE: "Success fee",
  OTHER: "Other",
} as const;

export const MODE_LABELS = { CASH: "Cash", UPI: "UPI", BANK: "Bank transfer", CHEQUE: "Cheque", OTHER: "Other" } as const;
