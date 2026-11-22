import "server-only";
import { platform } from "@/lib/platform-db";
import { classifyHost, normalizeHost, subdomainUrl, publicScheme } from "./host";

export interface TenantInfo {
  id: string;
  slug: string;
  name: string;
  schema: string;
  status: "TRIAL" | "ACTIVE" | "SUSPENDED";
}

const SELECT = { id: true, slug: true, name: true, schema: true, status: true } as const;
const TTL_MS = 30_000;
const g = globalThis as unknown as { __tenantHostCache?: Map<string, { t: TenantInfo | null; at: number }> };
const cache = (g.__tenantHostCache ??= new Map());

/** The bureau served on this host, or null (unknown host or the console). Cached for 30 s. */
export async function tenantForHost(rawHost: string | null | undefined): Promise<TenantInfo | null> {
  const host = normalizeHost(rawHost);
  const hit = cache.get(host);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.t;
  const kind = classifyHost(host);
  let t: TenantInfo | null = null;
  if (kind.kind === "subdomain") {
    t = await platform.tenant.findUnique({ where: { slug: kind.slug }, select: SELECT });
  } else if (kind.kind === "custom") {
    const d = await platform.tenantDomain.findUnique({ where: { host: kind.host }, select: { active: true, tenant: { select: SELECT } } });
    t = d?.active ? d.tenant : null;
  }
  if (cache.size > 1000) cache.clear();
  cache.set(host, { t, at: Date.now() });
  return t;
}

/** Call after changing a bureau or its domains so every host sees it at once. */
export function invalidateTenantCache() {
  cache.clear();
}

export async function getTenantById(id: string): Promise<TenantInfo | null> {
  return platform.tenant.findUnique({ where: { id }, select: SELECT });
}

/** All bureaus (for the scheduler, migrations and nightly jobs). */
export async function listTenants(opts: { includeSuspended?: boolean } = {}): Promise<TenantInfo[]> {
  return platform.tenant.findMany({
    where: opts.includeSuspended ? {} : { status: { not: "SUSPENDED" } },
    select: SELECT,
    orderBy: { createdAt: "asc" },
  });
}

/** Public address of a bureau for links in emails: its active primary custom domain, else its subdomain. */
export async function tenantBaseUrl(t: Pick<TenantInfo, "id" | "slug">): Promise<string> {
  const d = await platform.tenantDomain.findFirst({ where: { tenantId: t.id, active: true, primary: true }, select: { host: true } });
  return d ? `${publicScheme()}://${d.host}` : subdomainUrl(t.slug);
}
