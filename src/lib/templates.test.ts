import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATES, TEMPLATE_VARS, readTemplates, renderTemplate, type TemplateKey } from "./templates";

describe("templates", () => {
  it("fills placeholders and keeps unknown ones visible", () => {
    expect(renderTemplate("Hi {name}, {amount} for {for}. {oops}", { name: "Gurdev", amount: "₹5,000", for: "Gold" }))
      .toBe("Hi Gurdev, ₹5,000 for Gold. {oops}");
  });
  it("tidies up empty values", () => {
    expect(renderTemplate("— {bureau} {bureau_phone}", { bureau: "Bureau", bureau_phone: null })).toBe("— Bureau");
  });
  it("falls back to defaults for missing or blank templates", () => {
    const t = readTemplates({ paymentDue: "Custom {amount}", renewal: "   " });
    expect(t.paymentDue).toBe("Custom {amount}");
    expect(t.renewal).toBe(DEFAULT_TEMPLATES.renewal);
    expect(readTemplates(null)).toEqual(DEFAULT_TEMPLATES);
  });
  it("defaults only use the placeholders documented for them", () => {
    for (const [k, tpl] of Object.entries(DEFAULT_TEMPLATES) as [TemplateKey, string][]) {
      const used = [...tpl.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]);
      for (const u of used) expect(TEMPLATE_VARS[k]).toContain(u);
    }
  });
});
