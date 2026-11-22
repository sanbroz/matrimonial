"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { FORM_LINK_DAYS, newFormToken } from "@/lib/services/form-links";
import { sendEmail, textToHtml } from "@/lib/services/email";
import { sendWhatsApp } from "@/lib/services/whatsapp";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const backTo = (fd: FormData, profileId: string) => {
  const r = str(fd, "returnTo");
  return r.startsWith("/profiles/") || r.startsWith("/leads/") ? r : `/profiles/${profileId}`;
};

/** Create a link for the family to fill in / update their own profile. */
export async function createFormLink(fd: FormData) {
  const user = await requireUser();
  const profileId = z.string().parse(fd.get("profileId"));
  const days = Number(str(fd, "days"));
  const valid = (FORM_LINK_DAYS as readonly number[]).includes(days) ? days : 7;
  const exists = await prisma.profile.findUnique({ where: { id: profileId }, select: { id: true } });
  if (!exists) redirect("/profiles");
  await prisma.profileFormLink.create({
    data: { token: newFormToken(), profileId, expiresAt: new Date(Date.now() + valid * 86400000), createdById: user.id },
  });
  const back = backTo(fd, profileId);
  revalidatePath(back);
  redirect(`${back}${back.includes("?") ? "&" : "?"}formlink=1#family-form`);
}

export async function revokeFormLink(fd: FormData) {
  await requireUser();
  const id = z.string().parse(fd.get("linkId"));
  const link = await prisma.profileFormLink.findUnique({ where: { id }, select: { profileId: true } });
  await prisma.profileFormLink.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
  const back = backTo(fd, link?.profileId ?? "");
  revalidatePath(back);
  redirect(`${back}#family-form`);
}

/** Send the self-fill link on WhatsApp or by email (logged on the profile). */
export async function sendFormLink(fd: FormData): Promise<{ ok: boolean; error?: string; note?: string }> {
  const user = await requireUser();
  try {
    const channel = z.enum(["whatsapp", "email"]).parse(fd.get("channel"));
    const profileId = z.string().parse(fd.get("profileId"));
    const text = str(fd, "text");
    const r =
      channel === "whatsapp"
        ? await sendWhatsApp({ phone: str(fd, "to"), text, kind: "form_link", profileId, userId: user.id })
        : await sendEmail({ to: str(fd, "to"), subject: str(fd, "subject") || "Your profile", text, html: textToHtml(text), kind: "form_link", profileId, userId: user.id });
    revalidatePath(`/profiles/${profileId}`);
    return r.ok ? { ok: true, note: "Link sent." } : { ok: false, error: r.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not sent" };
  }
}
