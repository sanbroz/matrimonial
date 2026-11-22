/** Public lead form links (enquiry forms per channel / campaign). Pure, unit-tested. */
import type { Gender, LeadSource } from "@prisma/client";

export const CHANNELS = {
  website: { label: "Website", source: "WEBSITE" },
  email: { label: "Email footer / newsletter", source: "EMAIL" },
  whatsapp: { label: "WhatsApp (status, groups)", source: "WHATSAPP" },
  facebook: { label: "Facebook", source: "SOCIAL_MEDIA" },
  instagram: { label: "Instagram", source: "SOCIAL_MEDIA" },
  campaign: { label: "Ad / marketing campaign", source: "OTHER" },
  other: { label: "Other", source: "OTHER" },
} as const satisfies Record<string, { label: string; source: LeadSource }>;
export type Channel = keyof typeof CHANNELS;
export const isChannel = (c: string): c is Channel => c in CHANNELS;

/** "Who is the match for?" on the public form → lead.forWhom and the candidate's gender. */
export const FOR_WHOM = {
  son: { label: "My son", forWhom: "Son", gender: "MALE" },
  daughter: { label: "My daughter", forWhom: "Daughter", gender: "FEMALE" },
  brother: { label: "My brother", forWhom: "Brother", gender: "MALE" },
  sister: { label: "My sister", forWhom: "Sister", gender: "FEMALE" },
  selfGroom: { label: "Myself (groom)", forWhom: "Self", gender: "MALE" },
  selfBride: { label: "Myself (bride)", forWhom: "Self", gender: "FEMALE" },
  relative: { label: "A relative", forWhom: "Relative", gender: null },
} as const satisfies Record<string, { label: string; forWhom: string; gender: Gender | null }>;
export type ForWhom = keyof typeof FOR_WHOM;

/** A mobile number from the public form: 10-digit Indian (with or without +91 / 0), or +country code. */
export function cleanEnquiryPhone(raw: string): string | null {
  const s = raw.trim();
  const plus = s.startsWith("+");
  let d = s.replace(/\D/g, "");
  if (!plus && d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (!plus && d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (!plus) return /^[6-9]\d{9}$/.test(d) ? d : null;
  return d.length >= 8 && d.length <= 15 ? `+${d}` : null;
}

export interface EnquiryInput {
  name: string;
  phone: string;
  forWhom: string;
  city: string;
  message: string;
  consent: boolean;
  /** Hidden "website" field: people never fill it, spam bots do */
  trap: string;
}

export type EnquiryCheck =
  | { ok: true; name: string; phone: string; forWhom: (typeof FOR_WHOM)[ForWhom] | null; city: string | null; message: string | null }
  | { ok: false; error: string; field?: string }
  | { ok: false; spam: true };

export function checkEnquiry(i: EnquiryInput): EnquiryCheck {
  if (i.trap.trim()) return { ok: false, spam: true };
  const name = i.name.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) return { ok: false, error: "Please enter your name.", field: "name" };
  const phone = cleanEnquiryPhone(i.phone);
  if (!phone) return { ok: false, error: "Please enter a valid mobile number (10 digits, or with + and country code).", field: "phone" };
  if (!i.consent) return { ok: false, error: "Please tick the box so we may contact you.", field: "consent" };
  const fw = i.forWhom in FOR_WHOM ? FOR_WHOM[i.forWhom as ForWhom] : null;
  return {
    ok: true,
    name,
    phone,
    forWhom: fw,
    city: i.city.trim().slice(0, 80) || null,
    message: i.message.trim().slice(0, 1000) || null,
  };
}
