"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/auth/server";
import { IMAGE_TYPES, UploadError, deleteUpload, saveUpload } from "@/lib/storage";
import { BIODATA_SECTIONS, biodataOptionsSchema } from "@/lib/biodata-options";
import { OPTION_CATEGORIES } from "@/lib/options-defaults";
import { matchingOptionsSchema } from "@/lib/matching";
import { MAX_FAVICON_BYTES, faviconType } from "@/lib/favicon";
import { setSessionCookie } from "@/lib/auth/cookie";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const optStr = (fd: FormData, k: string) => str(fd, k) || null;
const money = (fd: FormData, k: string) => {
  const n = Number(str(fd, k).replace(/[,₹\s]/g, "") || 0);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
};
const back = (path: string, msg: string, key = "ok") => redirect(`${path}?${key}=${encodeURIComponent(msg)}`);

// ───────────── Bureau & fees ─────────────

export async function saveBureauSettings(fd: FormData) {
  await requireOwner();
  const prefix = str(fd, "profileCodePrefix").toUpperCase().replace(/[^A-Z0-9\-]/g, "");
  const nextNum = Number(str(fd, "nextProfileNumber"));
  if (!prefix) back("/settings", "Profile code prefix cannot be empty", "error");
  if (!Number.isInteger(nextNum) || nextNum < 1) back("/settings", "Next profile number must be a whole number", "error");
  // Only change the counter when the owner edited it. Otherwise saving a stale form (opened before
  // other profiles were added) would set it back.
  const counterEdited = str(fd, "nextProfileNumberWas") !== String(nextNum);

  await prisma.settings.update({
    where: { id: 1 },
    data: {
      bureauName: str(fd, "bureauName") || "My Matrimonial Bureau",
      tagline: optStr(fd, "tagline"),
      phone: optStr(fd, "phone"),
      whatsapp: optStr(fd, "whatsapp"),
      email: optStr(fd, "email"),
      address: optStr(fd, "address"),
      profileCodePrefix: prefix,
      ...(counterEdited ? { nextProfileNumber: nextNum } : {}),
      registrationFee: money(fd, "registrationFee"),
      successFeeDefault: money(fd, "successFeeDefault"),
      receiptPrefix: str(fd, "receiptPrefix").toUpperCase() || "R",
    },
  });

  const logo = fd.get("logo");
  if (logo instanceof File && logo.size > 0) {
    const current = await prisma.settings.findUnique({ where: { id: 1 }, select: { logoPath: true } });
    try {
      const path = await saveUpload(logo, "branding", IMAGE_TYPES);
      await prisma.settings.update({ where: { id: 1 }, data: { logoPath: path } });
      await deleteUpload(current?.logoPath);
    } catch (e) {
      back("/settings", e instanceof UploadError ? e.message : "Logo upload failed", "error");
    }
  }
  const icon = fd.get("favicon");
  if (icon instanceof File && icon.size > 0) {
    if (icon.size > MAX_FAVICON_BYTES) back("/settings", "The browser-tab icon must be smaller than 256 KB", "error");
    const buf = new Uint8Array(await icon.arrayBuffer());
    const type = faviconType(buf);
    if (!type) back("/settings", "Browser-tab icon: use a PNG, ICO, JPG or WebP image", "error");
    await prisma.settings.update({ where: { id: 1 }, data: { favicon: Buffer.from(buf), faviconType: type } });
  }
  if (fd.get("removeFavicon") === "on") {
    await prisma.settings.update({ where: { id: 1 }, data: { favicon: null, faviconType: null } });
  }
  if (fd.get("removeLogo") === "on") {
    const current = await prisma.settings.findUnique({ where: { id: 1 }, select: { logoPath: true } });
    await prisma.settings.update({ where: { id: 1 }, data: { logoPath: null } });
    await deleteUpload(current?.logoPath);
  }
  revalidatePath("/", "layout");
  back("/settings", "Settings saved");
}

// ───────────── Biodata ─────────────

export async function saveBiodataSettings(fd: FormData) {
  await requireOwner();
  const options = biodataOptionsSchema.parse({
    accentColor: str(fd, "accentColor"),
    headerText: str(fd, "headerText"),
    footerText: str(fd, "footerText"),
    defaultLanguage: str(fd, "defaultLanguage"),
    sections: Object.keys(BIODATA_SECTIONS).filter((k) => fd.get(`section.${k}`) === "on"),
    showBureauContact: fd.get("showBureauContact") === "on",
  });
  await prisma.settings.update({ where: { id: 1 }, data: { biodataOptions: options } });
  revalidatePath("/settings/biodata");
  back("/settings/biodata", "Biodata settings saved");
}

// ───────────── Matching rules ─────────────

export async function saveMatchingSettings(fd: FormData) {
  await requireOwner();
  const options = matchingOptionsSchema.parse({
    gotraRule: str(fd, "gotraRule"),
    twoWay: fd.get("twoWay") === "on",
    includeOnHold: fd.get("includeOnHold") === "on",
    strictCastes: fd.get("strictCastes") === "on",
    strictCountries: fd.get("strictCountries") === "on",
  });
  await prisma.settings.update({ where: { id: 1 }, data: { matchingOptions: options } });
  revalidatePath("/settings/matching");
  back("/settings/matching", "Matching rules saved");
}

// ───────────── Plans ─────────────

const planSchema = z.object({
  name: z.string().trim().min(1, "Plan name is required"),
  durationDays: z.coerce.number().int().min(1, "Duration must be at least 1 day"),
  price: z.coerce.number().int().min(0),
  introLimit: z.preprocess((v) => (v === "" ? null : v), z.coerce.number().int().min(0).nullable()),
  successFee: z.preprocess((v) => (v === "" ? null : v), z.coerce.number().int().min(0).nullable()),
  description: z.string().trim().optional(),
});

export async function savePlan(fd: FormData) {
  await requireOwner();
  const id = str(fd, "id");
  const r = planSchema.safeParse({
    name: str(fd, "name"),
    durationDays: str(fd, "durationDays"),
    price: str(fd, "price").replace(/[,₹\s]/g, "") || "0",
    introLimit: str(fd, "introLimit"),
    successFee: str(fd, "successFee").replace(/[,₹\s]/g, ""),
    description: str(fd, "description"),
  });
  if (!r.success) back("/settings/plans", r.error!.issues[0].message, "error");
  // Active/inactive is only changed by the Activate/Deactivate button, never by saving the plan
  const data = { ...r.data!, description: r.data!.description || null };
  if (id) await prisma.plan.update({ where: { id }, data });
  else await prisma.plan.create({ data });
  revalidatePath("/settings/plans");
  back("/settings/plans", id ? "Plan updated" : "Plan added");
}

export async function togglePlan(fd: FormData) {
  await requireOwner();
  const id = z.string().parse(fd.get("id"));
  const plan = await prisma.plan.findUnique({ where: { id } });
  if (plan) await prisma.plan.update({ where: { id }, data: { active: !plan.active } });
  revalidatePath("/settings/plans");
}

// ───────────── Staff ─────────────

export async function saveStaff(fd: FormData) {
  const me = await requireOwner();
  const id = str(fd, "id");
  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  const role = fd.get("role") === "OWNER" ? "OWNER" : "STAFF";
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) back("/settings/staff", "Enter a name and a valid email", "error");
  if (!id && password.length < 8) back("/settings/staff", "Password must be at least 8 characters", "error");
  if (id && password && password.length < 8) back("/settings/staff", "Password must be at least 8 characters", "error");
  if (id === me.id && role !== "OWNER") back("/settings/staff", "You cannot remove your own owner role", "error");

  const clash = await prisma.user.findFirst({ where: { email, id: id ? { not: id } : undefined } });
  if (clash) back("/settings/staff", "Another account already uses that email", "error");

  const data = {
    name,
    email,
    role: role as "OWNER" | "STAFF",
    ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
  };
  if (id) {
    // New password: end that person's other sessions
    const updated = await prisma.user.update({
      where: { id },
      data: { ...data, ...(password ? { tokenVersion: { increment: 1 } } : {}) },
    });
    // Keep the owner signed in on this device after changing their own password
    if (password && id === me.id) await setSessionCookie(updated);
  } else {
    await prisma.user.create({ data: { ...data, passwordHash: data.passwordHash! } });
  }
  revalidatePath("/settings/staff");
  back("/settings/staff", id ? "Account updated" : "Account created");
}

export async function toggleStaffActive(fd: FormData) {
  const me = await requireOwner();
  const id = z.string().parse(fd.get("id"));
  if (id === me.id) back("/settings/staff", "You cannot deactivate your own account", "error");
  const u = await prisma.user.findUnique({ where: { id } });
  if (u) await prisma.user.update({ where: { id }, data: { active: !u.active } });
  revalidatePath("/settings/staff");
}

// ───────────── Dropdown lists ─────────────

const categorySchema = z.enum(Object.keys(OPTION_CATEGORIES) as [string, ...string[]]);

/** Replace a whole list from a textarea (one value per line, in display order). */
export async function saveOptionList(fd: FormData) {
  await requireOwner();
  const category = categorySchema.parse(fd.get("category"));
  const values = [
    ...new Set(
      String(fd.get("values") ?? "")
        .split(/\r?\n/)
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ];
  await prisma.$transaction(async (tx) => {
    await tx.optionItem.deleteMany({ where: { category } });
    await tx.optionItem.createMany({ data: values.map((value, i) => ({ category, value, sortOrder: i })) });
  });
  revalidatePath("/settings/lists");
  redirect(`/settings/lists?cat=${category}&ok=${encodeURIComponent(`Saved ${values.length} values`)}`);
}
