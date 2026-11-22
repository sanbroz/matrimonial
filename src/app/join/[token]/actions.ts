"use server";

import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant/context";
import { clientIp } from "@/lib/auth/client-ip";
import { AttemptLimiter } from "@/lib/auth/rate-limit";
import { CHANNELS, checkEnquiry, isChannel } from "@/lib/lead-forms";
import { isEmailConfigured, sendEmail } from "@/lib/services/email";

export type EnquiryState = { done?: boolean; error?: string; field?: string; values?: Record<string, string> } | undefined;

// At most 5 enquiries per address per hour (genuine families send one)
const g = globalThis as unknown as { __enquiryLimit?: AttemptLimiter };
const limiter = (g.__enquiryLimit ??= new AttemptLimiter({ windowMs: 60 * 60_000, max: 5 }));

/** A family's enquiry from a public lead form link → a new lead (or a note on their existing one). */
export async function submitEnquiry(token: string, _prev: EnquiryState, fd: FormData): Promise<EnquiryState> {
  const tenant = await requireTenant();
  const form = tenant.status === "SUSPENDED" ? null : await prisma.leadForm.findUnique({ where: { token } });
  if (!form || !form.active) return { error: "This form is closed. Please contact the bureau directly." };
  const v = (k: string) => String(fd.get(k) ?? "");
  const values = { name: v("name"), phone: v("phone"), forWhom: v("forWhom"), city: v("city"), message: v("message") };
  const ip = await clientIp();
  if (limiter.blockedFor(`enq:${tenant.id}:${ip}`)) {
    return { error: "Too many enquiries were sent from this connection. Please try again later, or call us directly.", values };
  }

  const c = checkEnquiry({ ...values, consent: fd.get("consent") === "on", trap: v("website") });
  if (!c.ok) {
    if ("spam" in c) return { done: true }; // look successful to bots
    return { error: c.error, field: c.field, values };
  }
  limiter.fail(`enq:${tenant.id}:${ip}`);

  const owner = await prisma.user.findFirst({ where: { role: "OWNER", active: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!owner) return { error: "Sorry, the form isn't available right now." };
  const channel = isChannel(form.channel) ? form.channel : "other";
  const via = `${form.name} (${CHANNELS[channel].label})`;
  const summary = [c.forWhom && `For: ${c.forWhom.label.toLowerCase()}`, c.city && `City: ${c.city}`, c.message].filter(Boolean).join("\n");

  // Same number enquired in the last 90 days → add to that lead instead of a duplicate
  const last10 = c.phone.replace(/\D/g, "").slice(-10);
  const existing = await prisma.lead.findFirst({
    where: { phone: { contains: last10 }, createdAt: { gte: new Date(Date.now() - 90 * 86400000) } },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, leadFormId: true, profileId: true },
  });
  if (existing) {
    const body = `Enquired again via ${via}.${summary ? `\n${summary}` : ""}`;
    // Already a profile: the note and call-back go on the profile, where staff work with the family
    const target = existing.profileId ? { profileId: existing.profileId } : { leadId: existing.id };
    await prisma.$transaction(async (tx) => {
      await tx.note.create({ data: { kind: "OTHER", body, ...target, authorId: owner.id } });
      await tx.followUp.create({ data: { title: "Call back: enquired again online", dueAt: new Date(), ...target, createdById: owner.id } });
      await tx.lead.update({
        where: { id: existing.id },
        data: {
          ...(existing.leadFormId ? {} : { leadFormId: form.id }),
          // A lost lead that comes back is open again
          ...(existing.status === "LOST" ? { status: "FOLLOW_UP" as const, lostReason: null } : {}),
        },
      });
    });
  } else {
    await prisma.lead.create({
      data: {
        name: c.name,
        phone: c.phone,
        source: CHANNELS[channel].source,
        forWhom: c.forWhom?.forWhom ?? null,
        gender: c.forWhom?.gender ?? null,
        city: c.city,
        details: [c.message, `Came in through: ${via}`].filter(Boolean).join("\n\n"),
        status: "NEW",
        leadFormId: form.id,
        createdById: owner.id,
        followUps: { create: { title: "Call new online enquiry", dueAt: new Date(), createdById: owner.id } },
      },
    });
  }

  // Tell the owners (if email is set up); never holds up the family's thank-you page
  void (async () => {
    if (!(await isEmailConfigured())) return;
    const owners = await prisma.user.findMany({ where: { role: "OWNER", active: true }, select: { email: true } });
    for (const o of owners) {
      await sendEmail({
        to: o.email,
        subject: `New enquiry: ${c.name} (${form.name})`,
        text: `${c.name} · ${c.phone}\n${summary}\n\nCame in through: ${via}${existing ? "\n(They had enquired before: added to their existing lead.)" : ""}`,
        kind: "new_lead",
      });
    }
  })().catch((e) => console.error("[enquiry] owner email failed", e));

  return { done: true };
}
