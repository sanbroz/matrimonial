/**
 * Editable message templates (Settings → Messages). Placeholders in {curly} braces.
 * Pure functions (unit-tested).
 */

export const TEMPLATE_KEYS = {
  biodataWhatsApp: "WhatsApp: biodata caption",
  biodataEmailSubject: "Email: biodata subject",
  biodataEmailBody: "Email: biodata message",
  paymentDue: "WhatsApp: payment due reminder",
  renewal: "WhatsApp: membership renewal reminder",
  meeting: "WhatsApp: meeting reminder",
  receiptWhatsApp: "WhatsApp: receipt caption",
  receiptEmailBody: "Email: receipt message",
} as const;

export type TemplateKey = keyof typeof TEMPLATE_KEYS;
export type Templates = Record<TemplateKey, string>;

/** Which placeholders each template can use (shown as help in Settings). */
export const TEMPLATE_VARS: Record<TemplateKey, string[]> = {
  biodataWhatsApp: ["name", "code", "bureau", "bureau_phone"],
  biodataEmailSubject: ["code", "bureau"],
  biodataEmailBody: ["name", "code", "bureau", "bureau_phone"],
  paymentDue: ["name", "code", "amount", "for", "bureau", "bureau_phone"],
  renewal: ["name", "code", "plan", "end_date", "bureau", "bureau_phone"],
  meeting: ["name", "code", "other_code", "meeting_time", "bureau", "bureau_phone"],
  receiptWhatsApp: ["name", "code", "receipt_no", "amount", "for", "bureau"],
  receiptEmailBody: ["name", "code", "receipt_no", "amount", "for", "bureau", "bureau_phone"],
};

export const DEFAULT_TEMPLATES: Templates = {
  biodataWhatsApp:
    "Sat Sri Akal {name} ji 🙏\nPlease find the biodata of profile {code}. Let us know if the family would like to take this forward.\n— {bureau} {bureau_phone}",
  biodataEmailSubject: "Biodata {code} from {bureau}",
  biodataEmailBody:
    "Sat Sri Akal {name} ji,\n\nPlease find attached the biodata of profile {code}. Do let us know if your family would like to take this forward.\n\nRegards,\n{bureau}\n{bureau_phone}",
  paymentDue:
    "Sat Sri Akal {name} ji 🙏\nA gentle reminder: {amount} is pending for {for} (profile {code}). Please pay at your convenience.\n— {bureau} {bureau_phone}",
  renewal:
    "Sat Sri Akal {name} ji 🙏\nYour {plan} membership (profile {code}) ends on {end_date}. Renew to keep receiving matching profiles.\n— {bureau} {bureau_phone}",
  meeting:
    "Sat Sri Akal {name} ji 🙏\nReminder: the meeting with the family of profile {other_code} is on {meeting_time}. Please let us know if anything changes.\n— {bureau} {bureau_phone}",
  receiptWhatsApp: "Thank you {name} ji 🙏 Receipt {receipt_no}: {amount} received for {for}.\n— {bureau}",
  receiptEmailBody:
    "Dear {name} ji,\n\nThank you for your payment. Receipt {receipt_no}: {amount} received for {for} (profile {code}).\n\nRegards,\n{bureau}\n{bureau_phone}",
};

export function readTemplates(json: unknown): Templates {
  const saved = (json && typeof json === "object" ? json : {}) as Partial<Record<string, unknown>>;
  const out = { ...DEFAULT_TEMPLATES };
  for (const k of Object.keys(DEFAULT_TEMPLATES) as TemplateKey[]) {
    const v = saved[k];
    if (typeof v === "string" && v.trim()) out[k] = v;
  }
  return out;
}

/** Replace {placeholders}; unknown ones are left as-is so mistakes are visible. Blank lines collapse. */
export function renderTemplate(tpl: string, vars: Record<string, string | number | null | undefined>): string {
  return tpl
    .replace(/\{([a-z_]+)\}/g, (m, k: string) => {
      const v = vars[k];
      return v === undefined ? m : v === null ? "" : String(v);
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
