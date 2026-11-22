import { describe, expect, it } from "vitest";
import { addCycles, billingState, daysOverdue, shouldAutoSuspend } from "./billing";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("billing", () => {
  it("adds cycles and keeps month ends valid", () => {
    expect(addCycles(d("2026-01-31"), "MONTHLY")).toEqual(d("2026-02-28"));
    expect(addCycles(d("2026-11-15"), "QUARTERLY")).toEqual(d("2027-02-15"));
    expect(addCycles(d("2026-08-31"), "HALF_YEARLY")).toEqual(d("2027-02-28"));
    expect(addCycles(d("2028-02-29"), "YEARLY")).toEqual(d("2029-02-28"));
    expect(addCycles(d("2026-01-10"), "MONTHLY", 3)).toEqual(d("2026-04-10"));
  });

  it("counts overdue days by calendar date", () => {
    expect(daysOverdue(d("2026-11-20"), new Date("2026-11-22T23:00:00Z"))).toBe(2);
    expect(daysOverdue(d("2026-11-25"), d("2026-11-22"))).toBe(-3);
  });

  it("classifies the billing state", () => {
    expect(billingState(null, d("2026-11-22"))).toBe("none");
    expect(billingState(d("2026-12-30"), d("2026-11-22"))).toBe("ok");
    expect(billingState(d("2026-11-25"), d("2026-11-22"))).toBe("due_soon");
    expect(billingState(d("2026-11-22"), d("2026-11-22"))).toBe("due_soon");
    expect(billingState(d("2026-11-21"), d("2026-11-22"))).toBe("overdue");
  });

  it("auto-suspends only after the grace days", () => {
    const t = { status: "ACTIVE", nextDueDate: d("2026-11-10"), autoSuspendDays: 7 };
    expect(shouldAutoSuspend(t, d("2026-11-17"))).toBe(false);
    expect(shouldAutoSuspend(t, d("2026-11-18"))).toBe(true);
    expect(shouldAutoSuspend({ ...t, autoSuspendDays: null }, d("2026-12-18"))).toBe(false);
    expect(shouldAutoSuspend({ ...t, status: "SUSPENDED" }, d("2026-12-18"))).toBe(false);
  });
});
