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
