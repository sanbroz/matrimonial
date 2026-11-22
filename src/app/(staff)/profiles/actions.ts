"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOwner, requireUser } from "@/lib/auth/server";
import { parseProfileValues } from "@/lib/profile-fields";
import { formDataToValues, type FormValues } from "@/lib/profile-form-values";
import { changedSince, createProfile, findProfileByPhone } from "@/lib/services/profiles";
import { DOC_TYPES, IMAGE_TYPES, UploadError, deleteUpload, saveUpload } from "@/lib/storage";

export type ProfileFormState = {
  errors?: Record<string, string>;
  message?: string;
  values?: FormValues;
  ts?: number;
  /** The family's self-fill form was saved */
  saved?: boolean;
  /** The profile's version after a save (so the next save from the same form isn't a "conflict") */
  version?: string;
};

const STATUS = z.enum(["ACTIVE", "ON_HOLD", "MATCHED", "CLOSED"]);

function parseForm(fd: FormData) {
  const values = formDataToValues(fd);
  const parsed = parseProfileValues((name) => values[name], { requireAll: true });
  const extras = {
    status: STATUS.catch("ACTIVE").parse(values.status),
    urgent: values.urgent === true,
    vip: values.vip === true,
    specialCase: values.specialCase === true,
    consentGiven: values.consentGiven === true,
  };
  return { values, parsed, extras };
}

export async function createProfileAction(_prev: ProfileFormState, fd: FormData): Promise<ProfileFormState> {
  const user = await requireUser();
  const { values, parsed, extras } = parseForm(fd);
  if (Object.keys(parsed.errors).length) {
    return { errors: parsed.errors, message: "Please fix the highlighted fields.", values, ts: Date.now() };
  }

  const dup = await findProfileByPhone(parsed.profile.phone as string | null);
  if (dup && fd.get("allowDuplicate") !== "on") {
    return {
      errors: { phone: `This phone is already on profile ${dup.code} (${dup.fullName}).` },
      message: `Possible duplicate of ${dup.code}. Tick "Save anyway" to create it regardless.`,
      values: { ...values, showAllowDuplicate: true },
      ts: Date.now(),
    };
  }

  let leadId = String(fd.get("leadId") ?? "") || undefined;
  if (leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { profileId: true } });
    if (!lead || lead.profileId) leadId = undefined;
  }

  const profile = await createProfile({ ...parsed.profile, ...extras }, parsed.preference, user.id, { leadId });
  revalidatePath("/profiles");
  redirect(`/profiles/${profile.id}?created=1`);
}

export async function updateProfileAction(id: string, _prev: ProfileFormState, fd: FormData): Promise<ProfileFormState> {
  await requireUser();
  const { values, parsed, extras } = parseForm(fd);
  if (Object.keys(parsed.errors).length) {
    return { errors: parsed.errors, message: "Please fix the highlighted fields.", values, ts: Date.now() };
  }
  const existing = await prisma.profile.findUnique({ where: { id }, select: { consentGiven: true, consentAt: true } });
  if (!existing) return { message: "Profile not found." };
  if (await changedSince(id, fd)) return { message: "This profile was changed by someone else (or by the family) while it was open here. Open it again to see the latest details, then make your changes.", values, ts: Date.now() };
  const dup = parsed.profile.phone ? await findProfileByPhone(parsed.profile.phone as string, id) : null;
  if (dup && fd.get("allowDuplicate") !== "on") {
    return {
      errors: { phone: `This phone is already on profile ${dup.code} (${dup.fullName}).` },
      message: `Possible duplicate of ${dup.code}. Tick "Save anyway" to keep it.`,
      values: { ...values, showAllowDuplicate: true },
      ts: Date.now(),
    };
  }

  await prisma.profile.update({
    where: { id },
    data: {
      ...(parsed.profile as object),
      ...extras,
      consentAt: extras.consentGiven ? (existing.consentAt ?? new Date()) : null,
      preference: { upsert: { create: parsed.preference as object, update: parsed.preference as object } },
    },
  });
  revalidatePath(`/profiles/${id}`);
  revalidatePath("/profiles");
  redirect(`/profiles/${id}?saved=1`);
}

// ───────────── Photos & kundli ─────────────

/** Uploads ONE photo (the browser sends files one by one, already resized). */
export async function uploadPhoto(fd: FormData): Promise<{ error?: string }> {
  await requireUser();
  const profileId = z.string().parse(fd.get("profileId"));
  const file = fd.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "No file" };
  const exists = await prisma.profile.findUnique({ where: { id: profileId }, select: { id: true } });
  if (!exists) return { error: "Profile not found" };
  try {
    const path = await saveUpload(file, `profiles/${profileId}`, IMAGE_TYPES);
    const count = await prisma.photo.count({ where: { profileId } });
    await prisma.photo.create({ data: { profileId, path, isPrimary: count === 0, sortOrder: count } });
  } catch (e) {
    return { error: e instanceof UploadError ? e.message : "Upload failed" };
  }
  revalidatePath(`/profiles/${profileId}`);
  return {};
}

export async function photoAction(fd: FormData) {
  await requireUser();
  const id = z.string().parse(fd.get("photoId"));
  const op = z.enum(["primary", "toggleBiodata", "delete"]).parse(fd.get("op"));
  const photo = await prisma.photo.findUnique({ where: { id } });
  if (!photo) return;
  if (op === "primary") {
    await prisma.$transaction(async (tx) => {
      await tx.photo.updateMany({ where: { profileId: photo.profileId }, data: { isPrimary: false } });
      await tx.photo.update({ where: { id }, data: { isPrimary: true } });
    });
  } else if (op === "toggleBiodata") {
    await prisma.photo.update({ where: { id }, data: { onBiodata: !photo.onBiodata } });
  } else {
    await prisma.photo.delete({ where: { id } });
    await deleteUpload(photo.path);
    if (photo.isPrimary) {
      const next = await prisma.photo.findFirst({ where: { profileId: photo.profileId }, orderBy: { sortOrder: "asc" } });
      if (next) await prisma.photo.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
  }
  revalidatePath(`/profiles/${photo.profileId}`);
}

export async function uploadKundli(fd: FormData) {
  await requireUser();
  const profileId = z.string().parse(fd.get("profileId"));
  const file = fd.get("kundli");
  const profile = await prisma.profile.findUnique({ where: { id: profileId }, select: { kundliPath: true } });
  if (!profile) return;
  if (fd.get("op") === "delete") {
    await prisma.profile.update({ where: { id: profileId }, data: { kundliPath: null } });
    await deleteUpload(profile.kundliPath);
  } else if (file instanceof File && file.size > 0) {
    try {
      const path = await saveUpload(file, `profiles/${profileId}/kundli`, DOC_TYPES);
      await prisma.profile.update({ where: { id: profileId }, data: { kundliPath: path } });
      await deleteUpload(profile.kundliPath);
    } catch (e) {
      redirect(`/profiles/${profileId}?uploadError=${encodeURIComponent(e instanceof UploadError ? e.message : "Upload failed")}`);
    }
  }
  revalidatePath(`/profiles/${profileId}`);
  redirect(`/profiles/${profileId}?saved=1`); // confirmation that the kundli was saved/removed
}

// ───────────── Delete (owner only, permanent — e.g. on the client's request) ─────────────

export async function deleteProfileAction(fd: FormData) {
  await requireOwner();
  const id = z.string().parse(fd.get("profileId"));
  const profile = await prisma.profile.findUnique({ where: { id }, include: { photos: true } });
  if (!profile) redirect("/profiles");
  if (String(fd.get("confirmCode") ?? "").trim().toUpperCase() !== profile.code.toUpperCase()) {
    redirect(`/profiles/${id}?deleteError=1#danger`);
  }
  await prisma.profile.delete({ where: { id } });
  await Promise.all([...profile.photos.map((p) => deleteUpload(p.path)), deleteUpload(profile.kundliPath)]);
  revalidatePath("/profiles");
  redirect(`/profiles?deleted=${encodeURIComponent(profile.code)}`);
}
