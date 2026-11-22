import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { phoneKey } from "@/lib/parse";

type Tx = Prisma.TransactionClient;

/** Highest number used after `prefix` in existing codes (PM1042 → 1042), or 0. */
export async function highestCodeNumber(tx: Tx, prefix: string): Promise<number> {
  const rows = await tx.profile.findMany({ where: { code: { startsWith: prefix } }, select: { code: true } });
  let max = 0;
  for (const r of rows) {
    const n = Number(r.code.slice(prefix.length));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return max;
}

/**
 * Atomically takes the next number from Settings → e.g. "PM1001".
 * If that code is already taken (counter set back by hand, prefix changed back), the counter jumps
 * past the highest existing code instead of failing.
 */
export async function nextProfileCode(tx: Tx): Promise<string> {
  const s = await tx.settings.update({
    where: { id: 1 },
    data: { nextProfileNumber: { increment: 1 } },
    select: { profileCodePrefix: true, nextProfileNumber: true },
  });
  const code = `${s.profileCodePrefix}${s.nextProfileNumber - 1}`;
  if (!(await tx.profile.findUnique({ where: { code }, select: { id: true } }))) return code;

  const next = (await highestCodeNumber(tx, s.profileCodePrefix)) + 1;
  await tx.settings.update({ where: { id: 1 }, data: { nextProfileNumber: next + 1 } });
  return `${s.profileCodePrefix}${next}`;
}

export async function createProfile(
  data: Record<string, unknown>,
  preference: Record<string, unknown>,
  userId: string,
  opts: { leadId?: string; importedFrom?: string } = {},
) {
  return prisma.$transaction(async (tx) => {
    const code = await nextProfileCode(tx);
    const profile = await tx.profile.create({
      data: {
        ...(data as Prisma.ProfileUncheckedCreateInput),
        code,
        createdById: userId,
        importedFrom: opts.importedFrom,
        consentAt: data.consentGiven ? new Date() : null,
        preference: { create: preference as Prisma.PartnerPreferenceCreateWithoutProfileInput },
      },
    });
    if (opts.leadId) {
      // Only if the lead isn't converted yet (two people converting the same lead at once)
      const linked = await tx.lead.updateMany({
        where: { id: opts.leadId, profileId: null },
        data: { profileId: profile.id, status: "CONVERTED" },
      });
      if (linked.count === 1) {
        // Carry the lead's notes and open follow-ups over to the profile
        await tx.note.updateMany({ where: { leadId: opts.leadId }, data: { profileId: profile.id, leadId: null } });
        await tx.followUp.updateMany({ where: { leadId: opts.leadId }, data: { profileId: profile.id, leadId: null } });
      }
    }
    return profile;
  });
}

/** phoneKey → profile code, for duplicate warnings. */
export async function existingPhoneIndex(): Promise<Map<string, string>> {
  const rows = await prisma.profile.findMany({ select: { code: true, phone: true, altPhone: true } });
  const map = new Map<string, string>();
  for (const r of rows) {
    for (const p of [r.phone, r.altPhone]) {
      const k = phoneKey(p);
      if (k) map.set(k, r.code);
    }
  }
  return map;
}

export async function findProfileByPhone(phone: string | null | undefined, excludeId?: string) {
  const k = phoneKey(phone);
  if (!k) return null;
  return prisma.profile.findFirst({
    where: {
      id: excludeId ? { not: excludeId } : undefined,
      OR: [{ phone: { endsWith: k } }, { altPhone: { endsWith: k } }],
    },
    select: { id: true, code: true, fullName: true },
  });
}

/** Dropdown suggestions for all categories. */
export async function loadOptions(): Promise<Record<string, string[]>> {
  const items = await prisma.optionItem.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { value: "asc" }] });
  const out: Record<string, string[]> = {};
  for (const i of items) (out[i.category] ??= []).push(i.value);
  return out;
}

/** True when the profile changed since a form was opened (the form's hidden "_version" = updatedAt). */
export async function changedSince(id: string, fd: FormData) {
  const v = String(fd.get("_version") ?? "");
  if (!v) return false;
  const p = await prisma.profile.findUnique({ where: { id }, select: { updatedAt: true } });
  return !!p && p.updatedAt.toISOString() !== v;
}
