import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

export const FORM_LINK_DAYS = [3, 7, 14, 30] as const;
export const FAMILY_MAX_PHOTOS = 8;
/** Sections a family fills in themselves (everything a bureau uses, except internal status flags). */
export const FAMILY_SECTIONS = ["basic", "religion", "career", "location", "family", "contact", "preference"];

export const newFormToken = () => randomBytes(18).toString("base64url");

/** A self-fill link that can be used: exists, not switched off, not expired. */
export async function findActiveFormLink(token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const link = await prisma.profileFormLink.findUnique({ where: { token } });
  if (!link || link.revokedAt || link.expiresAt < new Date()) return null;
  return link;
}

/** The newest usable link for a profile (shown on the profile / lead page). */
export async function activeFormLinkFor(profileId: string) {
  return prisma.profileFormLink.findFirst({
    where: { profileId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
}
