"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { MAX_SHARE_PROFILES, SHARE_EXPIRY_DAYS, readShareOptions } from "@/lib/share";
import { readBiodataOptions } from "@/lib/biodata-options";
import { newShareToken } from "@/lib/services/share";
import { sendEmail, textToHtml } from "@/lib/services/email";
import { sendWhatsApp } from "@/lib/services/whatsapp";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
/** Selected profile ids: repeated "id" fields, or one comma-separated "ids" field (send dialog). */
const ids = (fd: FormData) =>
  [...new Set([...fd.getAll("id").map(String), ...str(fd, "ids").split(",")].map((s) => s.trim()).filter(Boolean))].slice(0, MAX_SHARE_PROFILES);

/** Records "shared" proposals from the family (clientId) to each candidate of the other gender. Returns how many were new. */
async function recordShared(clientId: string, candidateIds: string[], userId: string, note: string) {
  const client = await prisma.profile.findUnique({ where: { id: clientId }, select: { id: true, gender: true } });
  if (!client) return 0;
  const candidates = await prisma.profile.findMany({ where: { id: { in: candidateIds }, gender: { not: client.gender } }, select: { id: true } });
  let created = 0;
  for (const c of candidates) {
    const existing = await prisma.proposal.findUnique({ where: { fromProfileId_toProfileId: { fromProfileId: client.id, toProfileId: c.id } } });
    if (existing) {
      await prisma.proposalEvent.create({ data: { proposalId: existing.id, status: existing.status, note: `${note} again`, userId } });
    } else {
      await prisma.proposal.create({
        data: { fromProfileId: client.id, toProfileId: c.id, createdById: userId, events: { create: { status: "SHARED", userId, note } } },
      });
      created++;
    }
    revalidatePath(`/profiles/${c.id}`);
  }
  revalidatePath(`/profiles/${client.id}`);
  revalidatePath(`/profiles/${client.id}/matches`);
  return created;
}

/** Back to the share page with the same selection and options. */
function shareUrl(fd: FormData, extra: Record<string, string>) {
  const q = new URLSearchParams();
  for (const id of ids(fd)) q.append("id", id);
  for (const k of ["for", "layout", "lang"]) if (str(fd, k)) q.set(k, str(fd, k));
  for (const s of fd.getAll("sections")) q.append("sections", String(s));
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  return `/share?${q.toString()}`;
}

export async function createShareLink(fd: FormData) {
  const user = await requireUser();
  const chosen = ids(fd);
  if (!chosen.length) redirect("/profiles");
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: 1 }, select: { biodataOptions: true } });
  const bo = readBiodataOptions(settings.biodataOptions);
  const opts = readShareOptions(
    { layout: str(fd, "layout"), sections: fd.getAll("sections").map(String), lang: str(fd, "lang") },
    { sections: bo.sections, lang: bo.defaultLanguage },
    chosen.length,
  );
  const days = Number(str(fd, "days"));
  const validDays = (SHARE_EXPIRY_DAYS as readonly number[]).includes(days) ? days : 14;
  const forId = str(fd, "for") || null;
  const existing = await prisma.profile.count({ where: { id: { in: chosen } } });
  if (existing !== chosen.length) redirect(shareUrl(fd, { error: "Some profiles no longer exist. Check the selection." }));
  const link = await prisma.shareLink.create({
    data: {
      token: newShareToken(),
      title: str(fd, "title").slice(0, 120) || null,
      profileIds: chosen,
      forProfileId: forId,
      layout: opts.layout,
      sections: opts.sections,
      lang: opts.lang,
      expiresAt: new Date(Date.now() + validDays * 86400000),
      createdById: user.id,
    },
  });
  let note = "";
  if (forId && fd.get("record") === "on") {
    const n = await recordShared(forId, chosen, user.id, "Shared by link");
    note = ` Recorded as shared with the family (${n} new).`;
  }
  revalidatePath("/shares");
  redirect(shareUrl(fd, { link: link.id, ok: `Link created, valid for ${validDays} days.${note}` }));
}

export async function recordSharesAction(fd: FormData) {
  const user = await requireUser();
  const forId = z.string().parse(fd.get("for"));
  const n = await recordShared(forId, ids(fd), user.id, "Biodata shared");
  redirect(shareUrl(fd, { ok: `Recorded as shared (${n} new proposal${n === 1 ? "" : "s"}).` }));
}

/** Send the link (WhatsApp text) or the link + PDF (email). Logged on the family's profile when known. */
export async function sendShare(fd: FormData): Promise<{ ok: boolean; error?: string; note?: string }> {
  const user = await requireUser();
  try {
    const channel = z.enum(["whatsapp", "email"]).parse(fd.get("channel"));
    const forId = str(fd, "for") || null;
    const to = str(fd, "to");
    const text = str(fd, "text");
    let r;
    if (channel === "whatsapp") {
      r = await sendWhatsApp({ phone: to, text, kind: "share", profileId: forId, userId: user.id });
    } else {
      const f = fd.get("file");
      const attachments =
        f instanceof File && f.size > 0 && f.size <= 10 * 1024 * 1024 && f.type === "application/pdf"
          ? [{ filename: f.name.replace(/[^\w.\-]/g, "_").slice(0, 80), content: Buffer.from(await f.arrayBuffer()), contentType: "application/pdf" }]
          : [];
      r = await sendEmail({ to, subject: str(fd, "subject") || "(no subject)", text, html: textToHtml(text), attachments, kind: "share", profileId: forId, userId: user.id });
    }
    if (!r.ok) return { ok: false, error: r.error };
    let note = "Sent.";
    if (forId && fd.get("record") === "on") {
      const n = await recordShared(forId, ids(fd), user.id, channel === "whatsapp" ? "Shared on WhatsApp" : "Shared by email");
      note += ` Recorded as shared with the family (${n} new).`;
    }
    return { ok: true, note };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not sent" };
  }
}

export async function revokeShareLink(fd: FormData) {
  await requireUser();
  await prisma.shareLink.updateMany({ where: { id: str(fd, "linkId"), revokedAt: null }, data: { revokedAt: new Date() } });
  revalidatePath("/shares");
  const back = str(fd, "returnTo");
  redirect(back.startsWith("/share") ? back : "/shares?ok=Link%20switched%20off");
}
