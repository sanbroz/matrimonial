import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { phoneKey } from "@/lib/parse";

type Tx = Prisma.TransactionClient;

/** Atomically takes the next number from Settings → e.g. "PM1001". */
export async function nextProfileCode(tx: Tx): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const s = await tx.settings.update({
      where: { id: 1 },
      data: { nextProfileNumber: { increment: 1 } },
      select: { profileCodePrefix: true, nextProfileNumber: true },
    });
    const code = `${s.profileCodePrefix}${s.nextProfileNumber - 1}`;
    // Skip codes already taken (e.g. after the owner changed prefix/number).
    const taken = await tx.profile.findUnique({ where: { code }, select: { id: true } });
    if (!taken) return code;
  }
  throw new Error("Could not allocate a profile code — check Settings → profile numbering");
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
      await tx.lead.update({ where: { id: opts.leadId }, data: { profileId: profile.id, status: "CONVERTED" } });
      // Carry the lead's notes and open follow-ups over to the profile
      await tx.note.updateMany({ where: { leadId: opts.leadId }, data: { profileId: profile.id, leadId: null } });
      await tx.followUp.updateMany({ where: { leadId: opts.leadId }, data: { profileId: profile.id, leadId: null } });
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
