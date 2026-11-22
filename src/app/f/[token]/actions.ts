"use server";

import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant/context";
import { parseProfileValues, inputName, visibleFields } from "@/lib/profile-fields";
import { formDataToValues } from "@/lib/profile-form-values";
import { FAMILY_MAX_PHOTOS, FAMILY_SECTIONS, findActiveFormLink } from "@/lib/services/form-links";
import { hiddenProfileFields } from "@/lib/services/workflow";
import { IMAGE_TYPES, UploadError, saveUpload } from "@/lib/storage";
import { loginLimits } from "@/lib/auth/rate-limit";
import { clientIp } from "@/lib/auth/client-ip";
import type { ProfileFormState } from "@/app/(staff)/profiles/actions";

/** Fields a family may change through their link: the bureau's fields, minus internal ones. */
async function familyFields() {
  const hidden = await hiddenProfileFields();
  return new Set(visibleFields(hidden).filter((f) => FAMILY_SECTIONS.includes(f.section)).map(inputName));
}

/** The family's form (no login). Only the allowed fields are saved; staff get a note and a follow-up. */
export async function submitFamilyForm(token: string, _prev: ProfileFormState, fd: FormData): Promise<ProfileFormState> {
  const tenant = await requireTenant();
  const link = tenant.status === "SUSPENDED" ? null : await findActiveFormLink(token);
  if (!link) return { message: "This link has expired. Please ask the bureau for a new one." };
  // A few saves a minute is plenty for a family; stops abuse of a leaked link
  const key = `form:${link.id}`;
  if (loginLimits.ip.blockedFor(key) || loginLimits.ip.blockedFor(`form:${await clientIp()}`)) {
    return { message: "Too many attempts. Please try again in a few minutes." };
  }
  loginLimits.ip.fail(key);

  const values = formDataToValues(fd, await familyFields());
  if (fd.get("familyConsent") !== "on") {
    return { message: "Please tick the box at the end to confirm the details and your consent.", values, ts: Date.now() };
  }
  const parsed = parseProfileValues((name) => values[name], { requireAll: true });
  if (Object.keys(parsed.errors).length) {
    return { errors: parsed.errors, message: "Please check the highlighted fields.", values, ts: Date.now() };
  }
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const owner = await tx.user.findFirst({ where: { role: "OWNER", active: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
    await tx.profile.update({
      where: { id: link.profileId },
      data: {
        ...(parsed.profile as object),
        consentGiven: true,
        consentAt: now,
        preference: { upsert: { create: parsed.preference as object, update: parsed.preference as object } },
      },
    });
    await tx.profileFormLink.update({ where: { id: link.id }, data: { submissions: { increment: 1 }, lastSubmittedAt: now } });
    if (owner) {
      await tx.note.create({ data: { kind: "OTHER", body: "The family filled in / updated their details using the form link.", profileId: link.profileId, authorId: owner.id } });
      await tx.followUp.create({ data: { title: "Check details sent by the family", dueAt: now, profileId: link.profileId, createdById: owner.id } });
    }
  });
  return { values, ts: Date.now(), saved: true };
}

/** One photo from the family (already shrunk in their browser). */
export async function uploadFamilyPhoto(token: string, fd: FormData): Promise<{ error?: string }> {
  const tenant = await requireTenant();
  const link = tenant.status === "SUSPENDED" ? null : await findActiveFormLink(token);
  if (!link) return { error: "This link has expired" };
  const file = fd.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "No file" };
  const count = await prisma.photo.count({ where: { profileId: link.profileId } });
  if (count >= FAMILY_MAX_PHOTOS) return { error: `Up to ${FAMILY_MAX_PHOTOS} photos. Please send others to the bureau.` };
  try {
    const path = await saveUpload(file, `profiles/${link.profileId}`, IMAGE_TYPES);
    await prisma.photo.create({ data: { profileId: link.profileId, path, isPrimary: count === 0, sortOrder: count } });
  } catch (e) {
    return { error: e instanceof UploadError ? e.message : "Upload failed" };
  }
  return {};
}
