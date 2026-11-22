/**
 * Phone → WhatsApp number (digits with country code, no +).
 * Indian 10-digit numbers (optionally with a leading 0) get 91; numbers written with +country are kept.
 */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const plus = phone.trim().startsWith("+");
  let d = phone.replace(/\D/g, "");
  if (!plus && d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (!plus && d.length === 10) d = `91${d}`;
  return d.length >= 11 && d.length <= 15 ? d : null;
}
