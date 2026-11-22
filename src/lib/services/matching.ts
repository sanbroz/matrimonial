import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { rankCandidates, readMatchingOptions, type MatchProfile } from "@/lib/matching";
import { loadOptions } from "./profiles";
import { nowIST } from "@/lib/format";

const SELECT = {
  id: true,
  gender: true,
  dob: true,
  heightCm: true,
  maritalStatus: true,
  religion: true,
  caste: true,
  gotraSelf: true,
  gotraMother: true,
  gotraGrandmother: true,
  manglik: true,
  education: true,
  annualIncome: true,
  diet: true,
  country: true,
  city: true,
  nativeDistrict: true,
  urgent: true,
  preference: true,
  _count: { select: { photos: true } },
} satisfies Prisma.ProfileSelect;

type Row = Prisma.ProfileGetPayload<{ select: typeof SELECT }>;

function toMatch(r: Row): MatchProfile {
  return { ...r, hasPhoto: r._count.photos > 0, preference: r.preference };
}

/** Suggested matches for a client, plus excluded candidates with reasons. */
export async function suggestMatches(profileId: string) {
  const [client, settings, options] = await Promise.all([
    prisma.profile.findUnique({ where: { id: profileId }, select: SELECT }),
    prisma.settings.findUniqueOrThrow({ where: { id: 1 }, select: { matchingOptions: true } }),
    loadOptions(),
  ]);
  if (!client) return null;
  const opts = readMatchingOptions(settings.matchingOptions);

  // Anyone already shared with/from this client is hidden.
  const proposals = await prisma.proposal.findMany({
    where: { OR: [{ fromProfileId: profileId }, { toProfileId: profileId }] },
    select: { fromProfileId: true, toProfileId: true },
  });
  const alreadyShared = new Set(proposals.map((p) => (p.fromProfileId === profileId ? p.toProfileId : p.fromProfileId)));

  const pool = await prisma.profile.findMany({
    where: {
      id: { notIn: [profileId, ...alreadyShared] },
      gender: client.gender === "MALE" ? "FEMALE" : "MALE",
      status: { in: opts.includeOnHold ? ["ACTIVE", "ON_HOLD"] : ["ACTIVE"] },
    },
    select: SELECT,
  });

  const ranked = rankCandidates(toMatch(client), pool.map(toMatch), opts, {
    now: nowIST(), // ages by the India date
    educationOrder: options.education ?? [],
    incomeOrder: options.annualIncome ?? [],
  });
  return { ...ranked, options: opts, alreadySharedCount: alreadyShared.size };
}

/**
 * Number of suggested matches for several profiles at once (profiles list). Same rules as
 * suggestMatches(), but the candidate pool, settings and proposals are loaded once for the whole page.
 * Profiles that aren't active / on hold get no count.
 */
export async function countMatches(profileIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!profileIds.length) return out;
  const [settings, options] = await Promise.all([
    prisma.settings.findUniqueOrThrow({ where: { id: 1 }, select: { matchingOptions: true } }),
    loadOptions(),
  ]);
  const opts = readMatchingOptions(settings.matchingOptions);
  const statuses: ("ACTIVE" | "ON_HOLD")[] = opts.includeOnHold ? ["ACTIVE", "ON_HOLD"] : ["ACTIVE"];
  const [clients, pool, proposals] = await Promise.all([
    prisma.profile.findMany({ where: { id: { in: profileIds }, status: { in: ["ACTIVE", "ON_HOLD"] } }, select: SELECT }),
    prisma.profile.findMany({ where: { status: { in: statuses } }, select: SELECT }),
    prisma.proposal.findMany({
      where: { OR: [{ fromProfileId: { in: profileIds } }, { toProfileId: { in: profileIds } }] },
      select: { fromProfileId: true, toProfileId: true },
    }),
  ]);
  const shared = new Map<string, Set<string>>();
  const add = (a: string, b: string) => (shared.get(a) ?? shared.set(a, new Set()).get(a)!).add(b);
  for (const p of proposals) {
    add(p.fromProfileId, p.toProfileId);
    add(p.toProfileId, p.fromProfileId);
  }
  const byGender = { MALE: pool.filter((p) => p.gender === "MALE").map(toMatch), FEMALE: pool.filter((p) => p.gender === "FEMALE").map(toMatch) };
  const ctx = { now: nowIST(), educationOrder: options.education ?? [], incomeOrder: options.annualIncome ?? [] };
  for (const c of clients) {
    const skip = shared.get(c.id);
    const candidates = byGender[c.gender === "MALE" ? "FEMALE" : "MALE"].filter((p) => p.id !== c.id && !skip?.has(p.id));
    out.set(c.id, rankCandidates(toMatch(c), candidates, opts, ctx).suggested.length);
  }
  return out;
}
