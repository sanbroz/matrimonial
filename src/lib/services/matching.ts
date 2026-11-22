import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { rankCandidates, readMatchingOptions, type MatchProfile } from "@/lib/matching";
import { loadOptions } from "./profiles";
import { nowIST } from "@/lib/format";
import { currentTenant } from "@/lib/tenant/context";

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

export interface PendingMatchRow {
  id: string;
  code: string;
  fullName: string;
  gender: "MALE" | "FEMALE";
  dob: Date | null;
  religion: string | null;
  caste: string | null;
  city: string | null;
  country: string | null;
  urgent: boolean;
  photoPath: string | null;
  /** Suggested matches not yet shared with this family */
  count: number;
  /** When this family was last sent a profile (null = never) */
  lastSharedAt: Date | null;
}

/**
 * Active profiles that have suggested matches not yet shared with them (dashboard, daily email).
 * Urgent first, then the families waiting longest / with the most matches.
 */
const PENDING_TTL_MS = 2 * 60_000;
const gPending = globalThis as unknown as { __pendingMatches?: Map<string, { at: number; rows: PendingMatchRow[] }> };
const pendingCache = (gPending.__pendingMatches ??= new Map());

export async function pendingMatches(): Promise<PendingMatchRow[]> {
  const tenant = await currentTenant();
  const key = tenant?.schema ?? "";
  const hit = pendingCache.get(key);
  if (hit && Date.now() - hit.at < PENDING_TTL_MS) return hit.rows;
  const rows = await computePendingMatches();
  pendingCache.set(key, { at: Date.now(), rows });
  return rows;
}

/** Forget cached counts (after sharing, so the dashboard updates at once). */
export async function clearPendingMatchesCache() {
  const tenant = await currentTenant();
  pendingCache.delete(tenant?.schema ?? "");
}

async function computePendingMatches(): Promise<PendingMatchRow[]> {
  const active = await prisma.profile.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true, code: true, fullName: true, gender: true, dob: true, religion: true, caste: true, city: true, country: true, urgent: true,
      photos: { where: { isPrimary: true }, take: 1, select: { path: true } },
      proposalsSent: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });
  const counts = await countMatches(active.map((p) => p.id));
  return active
    .map((p) => ({
      id: p.id, code: p.code, fullName: p.fullName, gender: p.gender, dob: p.dob, religion: p.religion, caste: p.caste,
      city: p.city, country: p.country, urgent: p.urgent,
      photoPath: p.photos[0]?.path ?? null,
      count: counts.get(p.id) ?? 0,
      lastSharedAt: p.proposalsSent[0]?.createdAt ?? null,
    }))
    .filter((p) => p.count > 0)
    .sort(
      (a, b) =>
        Number(b.urgent) - Number(a.urgent) ||
        (a.lastSharedAt?.getTime() ?? 0) - (b.lastSharedAt?.getTime() ?? 0) ||
        b.count - a.count,
    );
}

/** Active profiles whose birthday falls in the next `days` days (India date), soonest first. */
export async function upcomingBirthdays(days = 7) {
  const now = new Date(Date.now() + 330 * 60000);
  const keys = Array.from({ length: days }, (_, i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i)).toISOString().slice(5, 10));
  const rows = await prisma.$queryRaw<{ id: string; code: string; fullName: string; dob: Date; phone: string | null }[]>`
    SELECT id, code, "fullName", dob, phone FROM "Profile"
    WHERE status = 'ACTIVE' AND dob IS NOT NULL AND to_char(dob, 'MM-DD') = ANY(${keys})`;
  return rows
    .map((r) => {
      const key = r.dob.toISOString().slice(5, 10);
      const inDays = keys.indexOf(key);
      return { ...r, inDays, turns: now.getUTCFullYear() - r.dob.getUTCFullYear() + (key < keys[0] ? 1 : 0) };
    })
    .sort((a, b) => a.inDays - b.inDays);
}
