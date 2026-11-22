import { describe, expect, it } from "vitest";
import { checkEnquiry, cleanEnquiryPhone } from "./lead-forms";

const base = { name: "Gurmeet Kaur", phone: "98140 12345", forWhom: "daughter", city: "Ludhiana", message: "", consent: true, trap: "" };

describe("public enquiry form", () => {
  it("accepts Indian mobiles in any common format and foreign numbers with +", () => {
    expect(cleanEnquiryPhone("98140 12345")).toBe("9814012345");
    expect(cleanEnquiryPhone("+91 98140-12345")).toBe("+919814012345");
    expect(cleanEnquiryPhone("919814012345")).toBe("9814012345");
    expect(cleanEnquiryPhone("09814012345")).toBe("9814012345");
    expect(cleanEnquiryPhone("+1 416 555 0100")).toBe("+14165550100");
    expect(cleanEnquiryPhone("12345")).toBeNull();
    expect(cleanEnquiryPhone("5814012345")).toBeNull(); // not a mobile
  });
  it("checks name, phone and consent; maps who it is for", () => {
    const r = checkEnquiry(base);
    expect(r).toMatchObject({ ok: true, name: "Gurmeet Kaur", phone: "9814012345", city: "Ludhiana", message: null });
    expect(r.ok && r.forWhom).toMatchObject({ forWhom: "Daughter", gender: "FEMALE" });
    expect(checkEnquiry({ ...base, name: " " })).toMatchObject({ ok: false, field: "name" });
    expect(checkEnquiry({ ...base, phone: "123" })).toMatchObject({ ok: false, field: "phone" });
    expect(checkEnquiry({ ...base, consent: false })).toMatchObject({ ok: false, field: "consent" });
  });
  it("treats a filled hidden field as spam", () => {
    expect(checkEnquiry({ ...base, trap: "http://spam" })).toEqual({ ok: false, spam: true });
  });
});
