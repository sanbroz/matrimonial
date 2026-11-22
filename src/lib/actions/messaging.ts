"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { sendEmail, textToHtml, type EmailAttachment } from "@/lib/services/email";
import { sendWhatsApp } from "@/lib/services/whatsapp";
import { readUpload } from "@/lib/storage";

type Result = { ok: boolean; error?: string; note?: string };
const CHANNEL = z.enum(["whatsapp", "email"]);
const MAX_FILE = 10 * 1024 * 1024;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function readFile(fd: FormData, allowed: string[]): Promise<{ buf: Buffer; type: string; name: string } | null> {
  const f = fd.get("file");
  if (!(f instanceof File) || f.size === 0) return null;
  if (f.size > MAX_FILE) throw new Error("Attachment is larger than 10 MB");
  if (!allowed.includes(f.type)) throw new Error("Attachment type not allowed");
  return { buf: Buffer.from(await f.arrayBuffer()), type: f.type, name: f.name.replace(/[^\w.\-]/g, "_").slice(0, 80) };
}

async function deliver(
  channel: "whatsapp" | "email",
  args: { to: string; text: string; subject?: string; file?: { buf: Buffer; type: string; name: string } | null; kind: string; profileId: string | null; userId: string },
) {
  if (channel === "whatsapp") {
    return sendWhatsApp({
      phone: args.to,
      text: args.text,
      image: args.file?.type === "image/jpeg" ? args.file.buf : undefined,
      kind: args.kind,
      profileId: args.profileId,
      userId: args.userId,
    });
  }
  const attachments: EmailAttachment[] = args.file ? [{ filename: args.file.name, content: args.file.buf, contentType: args.file.type }] : [];
  return sendEmail({
    to: args.to,
    subject: args.subject || "(no subject)",
    text: args.text,
    html: textToHtml(args.text),
    attachments,
    kind: args.kind,
    profileId: args.profileId,
    userId: args.userId,
  });
}

/** Send a biodata (JPG on WhatsApp, PDF by email). With forClientId it is also recorded as shared with that family. */
export async function sendBiodata(fd: FormData): Promise<Result> {
  const user = await requireUser();
  try {
    const channel = CHANNEL.parse(fd.get("channel"));
    const profileId = z.string().parse(fd.get("profileId"));
    const forClientId = str(fd, "forClientId") || null;
    const candidate = await prisma.profile.findUnique({ where: { id: profileId }, select: { code: true, gender: true } });
    if (!candidate) return { ok: false, error: "Profile not found" };
    const file = await readFile(fd, channel === "whatsapp" ? ["image/jpeg"] : ["application/pdf"]);
    const r = await deliver(channel, {
      to: str(fd, "to"), text: str(fd, "text"), subject: str(fd, "subject"), file,
      kind: "biodata", profileId: forClientId ?? profileId, userId: user.id,
    });
    if (!r.ok) return { ok: false, error: r.error };

    let note = `Biodata ${candidate.code} sent.`;
    if (forClientId) {
      const client = await prisma.profile.findUnique({ where: { id: forClientId }, select: { id: true, code: true, gender: true } });
      if (client && client.gender !== candidate.gender) {
        const how = channel === "whatsapp" ? "WhatsApp" : "email";
        const existing = await prisma.proposal.findUnique({ where: { fromProfileId_toProfileId: { fromProfileId: client.id, toProfileId: profileId } } });
        if (existing) {
          await prisma.proposalEvent.create({ data: { proposalId: existing.id, status: existing.status, note: `Biodata sent again by ${how}`, userId: user.id } });
        } else {
          await prisma.proposal.create({
            data: {
              fromProfileId: client.id, toProfileId: profileId, createdById: user.id,
              events: { create: { status: "SHARED", userId: user.id, note: `Biodata sent by ${how}` } },
            },
          });
        }
        note += ` Recorded as shared with ${client.code}.`;
        revalidatePath(`/profiles/${client.id}`);
        revalidatePath(`/profiles/${client.id}/matches`);
      }
    }
    revalidatePath(`/profiles/${profileId}`);
    return { ok: true, note };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not sent" };
  }
}

/** Send a receipt: WhatsApp image + caption, or email with the receipt image attached. */
export async function sendReceipt(fd: FormData): Promise<Result> {
  const user = await requireUser();
  try {
    const channel = CHANNEL.parse(fd.get("channel"));
    const payment = await prisma.payment.findUnique({ where: { id: z.string().parse(fd.get("paymentId")) } });
    if (!payment) return { ok: false, error: "Receipt not found" };
    if (payment.voidedAt) return { ok: false, error: "This receipt is void" };
    const file = await readFile(fd, ["image/jpeg"]);
    const r = await deliver(channel, {
      to: str(fd, "to"), text: str(fd, "text"), subject: str(fd, "subject"), file,
      kind: "receipt", profileId: payment.profileId, userId: user.id,
    });
    if (payment.profileId) revalidatePath(`/profiles/${payment.profileId}`);
    return r.ok ? { ok: true, note: `Receipt ${payment.receiptNo} sent.` } : { ok: false, error: r.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not sent" };
  }
}

/** WhatsApp reminders: payment due, membership renewal, meeting. */
export async function sendReminder(fd: FormData): Promise<Result> {
  const user = await requireUser();
  try {
    const kind = z.enum(["payment_due", "renewal", "meeting"]).parse(fd.get("kind"));
    const profileId = z.string().parse(fd.get("profileId"));
    const exists = await prisma.profile.findUnique({ where: { id: profileId }, select: { id: true } });
    if (!exists) return { ok: false, error: "Profile not found" };
    const r = await sendWhatsApp({ phone: str(fd, "to"), text: str(fd, "text"), kind, profileId, userId: user.id });
    revalidatePath(`/profiles/${profileId}`);
    return r.ok ? { ok: true, note: "Reminder sent on WhatsApp." } : { ok: false, error: r.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not sent" };
  }
}

/** Send the bureau's payment details (UPI / bank / QR image) to a lead or a profile's family. */
export async function sendPaymentDetails(fd: FormData): Promise<Result> {
  const user = await requireUser();
  try {
    const channel = CHANNEL.parse(fd.get("channel"));
    const profileId = str(fd, "profileId") || null;
    const leadId = str(fd, "leadId") || null;
    const s = await prisma.settings.findUniqueOrThrow({ where: { id: 1 }, select: { paymentQrPath: true } });
    const qr = s.paymentQrPath ? await readUpload(s.paymentQrPath).catch(() => null) : null;
    const file = qr ? { buf: qr.data, type: qr.type, name: `payment-qr${qr.type === "image/png" ? ".png" : ".jpg"}` } : null;
    let r;
    if (channel === "whatsapp") {
      r = await sendWhatsApp({ phone: str(fd, "to"), text: str(fd, "text"), image: file?.buf, kind: "payment_details", profileId, userId: user.id });
    } else {
      r = await sendEmail({
        to: str(fd, "to"),
        subject: str(fd, "subject") || "Payment details",
        text: str(fd, "text"),
        html: textToHtml(str(fd, "text")),
        attachments: file ? [{ filename: file.name, content: file.buf, contentType: file.type }] : [],
        kind: "payment_details",
        profileId,
        userId: user.id,
      });
    }
    if (!r.ok) return { ok: false, error: r.error };
    if (leadId) {
      await prisma.note.create({ data: { kind: channel === "whatsapp" ? "WHATSAPP" : "OTHER", body: `Payment details sent by ${channel === "whatsapp" ? "WhatsApp" : "email"}`, leadId, authorId: user.id } });
      revalidatePath(`/leads/${leadId}`);
    }
    if (profileId) revalidatePath(`/profiles/${profileId}`);
    return { ok: true, note: "Payment details sent." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not sent" };
  }
}
