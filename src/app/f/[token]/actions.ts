"use server";

import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant/context";
import { parseProfileValues, inputName, visibleFields } from "@/lib/profile-fields";
import { formDataToValues } from "@/lib/profile-form-values";
import { FAMILY_MAX_PHOTOS, FAMILY_SECTIONS, findActiveFormLink } from "@/lib/services/form-links";
import { hiddenProfileFields } from "@/lib/services/workflow";
import { IMAGE_TYPES, UploadError, deleteUpload, saveUpload } from "@/lib/storage";
import { AttemptLimiter } from "@/lib/auth/rate-limit";

// At most 20 photo uploads per link per hour
const g = globalThis as unknown as { __familyPhotoLimit?: AttemptLimiter };
const photoLimiter = (g.__familyPhotoLimit ??= new AttemptLimiter({ windowMs: 60 * 60_000, max: 20 }));
import { loginLimits } from "@/lib/auth/rate-limit";
import { clientIp } from "@/lib/auth/client-ip";
import type { ProfileFormState } from "@/app/(staff)/profiles/actions";
import { changedSince } from "@/lib/services/profiles";

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
  loginLimits.ip.fail(`form:${await clientIp()}`);

  const values = formDataToValues(fd, await familyFields());
  if (fd.get("familyConsent") !== "on") {
    return { message: "Please tick the box at the end to confirm the details and your consent.", values, ts: Date.now() };
  }
  if (await changedSince(link.profileId, fd)) {
    return { message: "The bureau updated your profile while this page was open. Please reload the page and check your details again.", values, ts: Date.now() };
  }
  const parsed = parseProfileValues((name) => values[name], { requireAll: true });
  if (Object.keys(parsed.errors).length) {
    return { errors: parsed.errors, message: "Please check the highlighted fields.", values, ts: Date.now() };
  }
  const now = new Date();
  let updated: { updatedAt: Date } | null = null;
  await prisma.$transaction(async (tx) => {
    const owner = await tx.user.findFirst({ where: { role: "OWNER", active: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
    updated = await tx.profile.update({
      select: { updatedAt: true },
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
  const version = (updated as { updatedAt: Date } | null)?.updatedAt.toISOString();
  return { values, ts: Date.now(), saved: true, version };
}

/**
 * One photo from the family (already shrunk in their browser). Not put on the biodata until staff
 * tick it (an unreviewed photo must never appear on share links sent to other families).
 */
export async function uploadFamilyPhoto(token: string, fd: FormData): Promise<{ error?: string }> {
  const tenant = await requireTenant();
  const link = tenant.status === "SUSPENDED" ? null : await findActiveFormLink(token);
  if (!link) return { error: "This link has expired" };
  const key = `famphoto:${link.id}`;
  if (photoLimiter.blockedFor(key)) return { error: "Too many photos at once. Please try again later." };
  photoLimiter.fail(key);
  const file = fd.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "No file" };
  const count = await prisma.photo.count({ where: { profileId: link.profileId } });
  if (count >= FAMILY_MAX_PHOTOS) return { error: `Up to ${FAMILY_MAX_PHOTOS} photos. Please send others to the bureau.` };
  try {
    const path = await saveUpload(file, `profiles/${link.profileId}`, IMAGE_TYPES);
    const ok = await prisma.$transaction(async (tx) => {
      const now = await tx.photo.count({ where: { profileId: link.profileId } });
      if (now >= FAMILY_MAX_PHOTOS) return false;
      await tx.photo.create({ data: { profileId: link.profileId, path, isPrimary: now === 0, sortOrder: now, onBiodata: false } });
      return true;
    });
    if (!ok) {
      await deleteUpload(path);
      return { error: `Up to ${FAMILY_MAX_PHOTOS} photos. Please send others to the bureau.` };
    }
  } catch (e) {
    return { error: e instanceof UploadError ? e.message : "Upload failed" };
  }
  return {};
}
