import "server-only";
import { prisma } from "@/lib/db";
import { platform } from "@/lib/platform-db";
import { currentTenant } from "@/lib/tenant/context";

/**
 * The icon for this request: the bureau's own, else the platform's, else none (standard icon).
 * `version` changes on upload, so pages can link /api/favicon?v=<version> and update at once.
 */
export async function resolveFavicon(withData = false): Promise<{ data?: Uint8Array; type: string; version: string } | null> {
  try {
    const t = await currentTenant();
    if (t && t.status !== "SUSPENDED") {
      const s = await prisma.settings.findUnique({
        where: { id: 1 },
        select: { faviconType: true, updatedAt: true, ...(withData ? { favicon: true } : {}) },
      });
      if (s?.faviconType) {
        return { type: s.faviconType, version: `b${s.updatedAt.getTime()}`, ...(withData && "favicon" in s && s.favicon ? { data: new Uint8Array(s.favicon as Buffer) } : {}) };
      }
    }
    const p = await platform.platformSettings.findUnique({
      where: { id: 1 },
      select: { faviconType: true, updatedAt: true, ...(withData ? { favicon: true } : {}) },
    });
    if (p?.faviconType) {
      return { type: p.faviconType, version: `p${p.updatedAt.getTime()}`, ...(withData && "favicon" in p && p.favicon ? { data: new Uint8Array(p.favicon as Buffer) } : {}) };
    }
  } catch {
    /* no database while building, or unknown host */
  }
  return null;
}
