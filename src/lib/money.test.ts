import { describe, expect, it } from "vitest";
import { amountInWords, daysLeft, dueBalance, dueStatusFor, membershipEnd, numberToIndianWords, rupees } from "./money";

describe("amount in words (Indian numbering)", () => {
  it.each([
    [0, "Zero"],
    [7, "Seven"],
    [15, "Fifteen"],
    [99, "Ninety Nine"],
    [100, "One Hundred"],
    [1001, "One Thousand One"],
    [12500, "Twelve Thousand Five Hundred"],
    [51000, "Fifty One Thousand"],
    [125000, "One Lakh Twenty Five Thousand"],
    [1000000, "Ten Lakh"],
    [21050075, "Two Crore Ten Lakh Fifty Thousand Seventy Five"],
  ])("%i → %s", (n, words) => {
    expect(numberToIndianWords(n)).toBe(words);
  });
  it("formats receipts", () => {
    expect(amountInWords(21000)).toBe("Rupees Twenty One Thousand Only");
    expect(rupees(125000)).toBe("₹1,25,000");
  });
});

describe("dues", () => {
  const due = { amount: 20000, status: "OPEN" };
  it("subtracts payments but ignores voided ones", () => {
    const pays = [
      { amount: 5000, voidedAt: null },
      { amount: 9000, voidedAt: new Date() },
      { amount: 10000, voidedAt: null },
    ];
    expect(dueBalance(due, pays)).toBe(5000);
    expect(dueStatusFor(due, pays)).toBe("OPEN");
    expect(dueStatusFor(due, [...pays, { amount: 5000, voidedAt: null }])).toBe("PAID");
  });
  it("never goes negative and waived stays waived", () => {
    expect(dueBalance(due, [{ amount: 25000, voidedAt: null }])).toBe(0);
    expect(dueBalance({ amount: 20000, status: "WAIVED" }, [])).toBe(0);
    expect(dueStatusFor({ amount: 20000, status: "WAIVED" }, [])).toBe("WAIVED");
  });
});

describe("membership dates", () => {
  it("end date is inclusive", () => {
    expect(membershipEnd(new Date(Date.UTC(2026, 0, 1)), 180).toISOString().slice(0, 10)).toBe("2026-06-29");
    expect(membershipEnd(new Date(Date.UTC(2026, 0, 1)), 1).toISOString().slice(0, 10)).toBe("2026-01-01");
  });
  it("counts days left in India time", () => {
    const end = new Date(Date.UTC(2026, 10, 30));
    // 21 Nov 2026 20:00 UTC is already 22 Nov in India
    expect(daysLeft(end, new Date(Date.UTC(2026, 10, 21, 20, 0)))).toBe(8);
    expect(daysLeft(end, new Date(Date.UTC(2026, 11, 2, 6, 0)))).toBe(-2);
  });
});
