/** Bureau billing (what each bureau pays the platform). Pure helpers, unit-tested. Dates are UTC midnight. */

export type Cycle = "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY";

export const CYCLE_MONTHS: Record<Cycle, number> = { MONTHLY: 1, QUARTERLY: 3, HALF_YEARLY: 6, YEARLY: 12 };
export const CYCLE_LABELS: Record<Cycle, string> = { MONTHLY: "Monthly", QUARTERLY: "Quarterly", HALF_YEARLY: "Half-yearly", YEARLY: "Yearly" };

/** Adds whole billing cycles; the day sticks to the month's end when needed (31 Jan + 1 month = 28/29 Feb). */
export function addCycles(date: Date, cycle: Cycle, count = 1): Date {
  const months = CYCLE_MONTHS[cycle] * count;
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(date.getUTCDate(), lastDay)));
}

/** Days past the due date (negative = days left), comparing calendar dates. */
export function daysOverdue(due: Date, today: Date): number {
  const a = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const b = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((b - a) / 86400000);
}

export type BillingState = "none" | "ok" | "due_soon" | "overdue";

export function billingState(nextDueDate: Date | null, today: Date, soonDays = 7): BillingState {
  if (!nextDueDate) return "none";
  const d = daysOverdue(nextDueDate, today);
  if (d > 0) return "overdue";
  if (d >= -soonDays) return "due_soon";
  return "ok";
}

/** Should the bureau be suspended automatically now? */
export function shouldAutoSuspend(t: { status: string; nextDueDate: Date | null; autoSuspendDays: number | null }, today: Date): boolean {
  if (t.status === "SUSPENDED" || t.autoSuspendDays == null || !t.nextDueDate) return false;
  return daysOverdue(t.nextDueDate, today) > t.autoSuspendDays;
}
