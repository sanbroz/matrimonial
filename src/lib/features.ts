/**
 * Which parts of the CRM a bureau uses (Settings → Features). Pure, unit-tested.
 * Everything defaults to ON, so existing bureaus keep working exactly as before.
 */
import { z } from "zod";

export const FEATURES = {
  payments: { label: "Payments & memberships", hint: "Plans, receipts, dues, payment details" },
  pipeline: { label: "Pipeline", hint: "Track each shared profile: interested, declined, matched" },
  horoscope: { label: "Horoscope / kundli", hint: "Birth time, manglik, rashi, kundli file" },
  leadForms: { label: "Online enquiry forms", hint: "Links for your website, Instagram, ads" },
  shareLinks: { label: "Share links", hint: "Web links to biodatas (downloads always work)" },
  whatsapp: { label: "WhatsApp sending", hint: "Send biodatas and reminders from your number" },
  email: { label: "Email sending", hint: "Send biodatas, receipts and the daily summary by email" },
  reports: { label: "Reports & export", hint: "Monthly numbers, Excel export" },
} as const;
export type Feature = keyof typeof FEATURES;
export type Features = Record<Feature, boolean>;

const ALL_ON = Object.fromEntries(Object.keys(FEATURES).map((k) => [k, true])) as Features;

export const featuresSchema = z
  .object(Object.fromEntries(Object.keys(FEATURES).map((k) => [k, z.boolean().catch(true)])) as Record<Feature, z.ZodCatch<z.ZodBoolean>>)
  .partial();

export function readFeatures(json: unknown): Features {
  const parsed = featuresSchema.safeParse(json ?? {});
  return { ...ALL_ON, ...(parsed.success ? parsed.data : {}) } as Features;
}

/** Ready-made setups. "Simple" = leads, profiles, matches and sharing only. */
export const PRESETS: Record<string, { label: string; hint: string; features: Features; meetings: boolean }> = {
  simple: {
    label: "Simple",
    hint: "Leads, profiles, matches and sharing biodatas. Nothing else to learn.",
    features: { ...ALL_ON, payments: false, pipeline: false, horoscope: false, leadForms: false, shareLinks: true, whatsapp: true, email: false, reports: false },
    meetings: false,
  },
  standard: {
    label: "Standard",
    hint: "Adds payments, the pipeline and email. Most bureaus.",
    features: { ...ALL_ON, leadForms: false },
    meetings: false,
  },
  advanced: {
    label: "Advanced",
    hint: "Everything, including meetings, enquiry forms and reports.",
    features: ALL_ON,
    meetings: true,
  },
};

/** Which preset the current switches equal (null = custom). */
export function presetOf(f: Features, meetings: boolean): string | null {
  for (const [k, p] of Object.entries(PRESETS)) {
    if (p.meetings === meetings && (Object.keys(FEATURES) as Feature[]).every((x) => p.features[x] === f[x])) return k;
  }
  return null;
}
