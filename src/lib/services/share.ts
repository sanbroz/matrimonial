import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { buildBiodata, type BiodataContent } from "@/lib/biodata";
import { readBiodataOptions, type BiodataOptions } from "@/lib/biodata-options";
import { nowIST } from "@/lib/format";
import { MAX_SHARE_PROFILES, type ShareOptions } from "@/lib/share";

export interface ShareItem {
  id: string;
  code: string;
  content: BiodataContent;
  /** Photo ids marked "on biodata" (empty when photos aren't shared) */
  photoIds: string[];
  photoPaths: string[];
}

export interface ShareBranding {
  bureauName: string;
  tagline: string | null;
  phone: string | null;
  whatsapp: string | null;
  logoPath: string | null;
}

/** Biodata content for the chosen profiles, in the given order, with the chosen sections only. */
export async function loadShareItems(ids: string[], opts: ShareOptions) {
  const unique = [...new Set(ids)].slice(0, MAX_SHARE_PROFILES);
  const [profiles, settings] = await Promise.all([
    prisma.profile.findMany({
      where: { id: { in: unique } },
      include: {
        preference: true,
        photos: { where: { onBiodata: true }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 3, select: { id: true, path: true } },
      },
    }),
    prisma.settings.findUniqueOrThrow({ where: { id: 1 } }),
  ]);
  const base = readBiodataOptions(settings.biodataOptions);
  const biodataOpts: BiodataOptions = { ...base, sections: opts.sections };
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const now = nowIST();
  const withPhotos = opts.sections.includes("photo");
  const items: ShareItem[] = unique
    .map((id) => byId.get(id))
    .filter((p) => !!p)
    .map((p) => ({
      id: p.id,
      code: p.code,
      content: buildBiodata(p, biodataOpts, opts.lang, now),
      photoIds: withPhotos ? p.photos.map((ph) => ph.id) : [],
      photoPaths: withPhotos ? p.photos.map((ph) => ph.path) : [],
    }));
  const branding: ShareBranding = {
    bureauName: settings.bureauName,
    tagline: settings.tagline,
    phone: settings.phone,
    whatsapp: settings.whatsapp,
    logoPath: settings.logoPath,
  };
  return { items, branding, biodataOptions: biodataOpts, statuses: profiles.map((p) => ({ id: p.id, code: p.code, status: p.status, gender: p.gender })) };
}

export const newShareToken = () => randomBytes(18).toString("base64url");

/** A link that can be shown: exists, not revoked, not expired. */
export async function findActiveShareLink(token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const link = await prisma.shareLink.findUnique({ where: { token } });
  if (!link || link.revokedAt || link.expiresAt < new Date()) return null;
  return link;
}
