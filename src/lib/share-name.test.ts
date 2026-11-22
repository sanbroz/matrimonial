import { describe, expect, it } from "vitest";
import { nameFor } from "./biodata";
import { paymentDetailsText, renderTemplate, DEFAULT_TEMPLATES } from "./templates";

describe("name on shared biodatas", () => {
  it("is hidden by default and can be first or full name", () => {
    expect(nameFor("Harpreet  Kaur Sandhu", "none")).toBeNull();
    expect(nameFor("Harpreet  Kaur Sandhu", undefined)).toBeNull();
    expect(nameFor("Harpreet  Kaur Sandhu", "first")).toBe("Harpreet");
    expect(nameFor(" Harpreet  Kaur Sandhu ", "full")).toBe("Harpreet Kaur Sandhu");
    expect(nameFor(null, "full")).toBeNull();
  });
});

describe("payment details message", () => {
  it("only lists what the bureau filled in", () => {
    expect(paymentDetailsText({ paymentUpi: "bureau@upi", paymentBank: null, paymentNote: null })).toBe("UPI: bureau@upi");
    expect(paymentDetailsText({ paymentUpi: null, paymentBank: "Acc name\nIFSC TEST", paymentNote: "Fee ₹1,100" }, true)).toBe(
      "(or scan the QR code)\nBank transfer:\nAcc name\nIFSC TEST\nFee ₹1,100",
    );
  });
  it("fills the WhatsApp template without empty 'UPI:' lines", () => {
    const text = renderTemplate(DEFAULT_TEMPLATES.paymentWhatsApp, {
      name: "Gurmeet",
      bureau: "Suitable Saathi",
      bureau_phone: "98140 00000",
      payment_details: paymentDetailsText({ paymentUpi: null, paymentBank: "Bank details", paymentNote: null }),
    });
    expect(text).toContain("Bank transfer:\nBank details");
    expect(text).not.toMatch(/UPI:\s*\n/);
    expect(text).not.toContain("{");
  });
});
