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
  shareWhatsApp: "WhatsApp: several biodatas (share link)",
  shareEmailSubject: "Email: several biodatas subject",
  shareEmailBody: "Email: several biodatas message",
  paymentWhatsApp: "WhatsApp / email: payment details",
  paymentEmailSubject: "Email: payment details subject",
  formLinkWhatsApp: "WhatsApp / email: link to fill in their profile",
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
  shareWhatsApp: ["name", "count", "codes", "link", "valid_till", "bureau", "bureau_phone"],
  shareEmailSubject: ["count", "bureau"],
  shareEmailBody: ["name", "count", "codes", "link", "valid_till", "bureau", "bureau_phone"],
  paymentWhatsApp: ["name", "payment_details", "bureau", "bureau_phone"],
  paymentEmailSubject: ["bureau"],
  formLinkWhatsApp: ["name", "link", "valid_till", "bureau", "bureau_phone"],
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
  shareWhatsApp:
    "Sat Sri Akal {name} ji 🙏\nHere are {count} profiles that may suit your family ({codes}):\n{link}\nThe link works until {valid_till}. Let us know which ones you would like to take forward.\n— {bureau} {bureau_phone}",
  shareEmailSubject: "{count} matching profiles from {bureau}",
  shareEmailBody:
    "Sat Sri Akal {name} ji,\n\nHere are {count} profiles that may suit your family ({codes}). View them online:\n{link}\n(the link works until {valid_till}). The PDF is attached as well.\n\nDo let us know which ones you would like to take forward.\n\nRegards,\n{bureau}\n{bureau_phone}",
  paymentWhatsApp:
    "Sat Sri Akal {name} ji 🙏\nYou can pay {bureau} by:\n\n{payment_details}\n\nPlease send us a screenshot once paid. Thank you!\n— {bureau} {bureau_phone}",
  paymentEmailSubject: "Payment details for {bureau}",
  formLinkWhatsApp:
    "Sat Sri Akal {name} ji 🙏\nPlease fill in your profile details here (it takes about 10 minutes):\n{link}\nThe link works until {valid_till}. You can add photos too.\n— {bureau} {bureau_phone}",
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

/** The bureau's payment details as one block for {payment_details} (only what is filled in). */
export function paymentDetailsText(s: { paymentUpi: string | null; paymentBank: string | null; paymentNote: string | null }, hasQr = false): string {
  return [
    s.paymentUpi && `UPI: ${s.paymentUpi}`,
    hasQr && "(or scan the QR code)",
    s.paymentBank && `Bank transfer:\n${s.paymentBank}`,
    s.paymentNote,
  ]
    .filter(Boolean)
    .join("\n");
}
