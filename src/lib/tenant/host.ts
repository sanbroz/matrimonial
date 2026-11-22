/**
 * Which bureau (tenant) a request is for, from its Host header. Pure and Edge-safe
 * (used by middleware and unit-tested).
 *
 *   <CONSOLE_SUBDOMAIN>.<PLATFORM_DOMAIN>  → super admin console   (bureau.sanbroz.com)
 *   <slug>.<PLATFORM_DOMAIN>               → that bureau           (matrimonial.sanbroz.com)
 *   anything else                          → a custom domain, looked up in the platform database
 *
 * In development PLATFORM_DOMAIN includes the port, e.g. "localhost:3000" → a.localhost:3000.
 */

export const DEFAULT_RESERVED_SLUGS = [
  "bureau", "admin", "www", "api", "app", "console", "mail", "smtp", "imap", "pop", "webmail",
  "ns1", "ns2", "cdn", "static", "assets", "status", "help", "support", "docs", "blog", "ftp", "test", "dev",
];

export function normalizeHost(host: string | null | undefined): string {
  return (host ?? "").trim().toLowerCase().replace(/\.$/, "");
}

export function platformDomain(): string {
  return normalizeHost(process.env.PLATFORM_DOMAIN || "localhost:3000");
}

export function consoleSubdomain(): string {
  return (process.env.CONSOLE_SUBDOMAIN || "bureau").toLowerCase();
}

export function consoleHost(): string {
  return `${consoleSubdomain()}.${platformDomain()}`;
}

/** Reserved slugs: defaults + the console + RESERVED_SLUGS (comma separated, e.g. other sites on the domain). */
export function reservedSlugs(): Set<string> {
  const extra = (process.env.RESERVED_SLUGS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return new Set([...DEFAULT_RESERVED_SLUGS, consoleSubdomain(), ...extra]);
}

export type HostKind =
  | { kind: "console" }
  | { kind: "subdomain"; slug: string }
  | { kind: "custom"; host: string }
  | { kind: "invalid" };

export function classifyHost(rawHost: string | null | undefined, domain = platformDomain(), consoleSub = consoleSubdomain()): HostKind {
  const host = normalizeHost(rawHost);
  if (!host || !/^[a-z0-9.:-]+$/.test(host)) return { kind: "invalid" };
  if (host === `${consoleSub}.${domain}`) return { kind: "console" };
  const suffix = `.${domain}`;
  if (host.endsWith(suffix)) {
    const sub = host.slice(0, -suffix.length);
    // Only one level: a.b.sanbroz.com is not a bureau
    if (!sub || sub.includes(".")) return { kind: "invalid" };
    return { kind: "subdomain", slug: sub };
  }
  if (host === domain) return { kind: "invalid" };
  return { kind: "custom", host };
}

const SLUG_RE = /^[a-z][a-z0-9-]{1,29}$/;

/** Returns an error message, or null when the slug can be used. */
export function slugError(slug: string, reserved = reservedSlugs()): string | null {
  if (!SLUG_RE.test(slug)) return "Use 2–30 lowercase letters, numbers or hyphens, starting with a letter.";
  if (slug.endsWith("-") || slug.includes("--")) return "Hyphens can't be at the end or doubled.";
  if (reserved.has(slug)) return `"${slug}" is reserved.`;
  return null;
}

/** PostgreSQL schema for a bureau. */
export const schemaForSlug = (slug: string) => `t_${slug.replace(/-/g, "_")}`;

export function publicScheme(): string {
  return process.env.PUBLIC_SCHEME || (process.env.NODE_ENV === "production" ? "https" : "http");
}

export const subdomainUrl = (slug: string) => `${publicScheme()}://${slug}.${platformDomain()}`;
export const consoleUrl = () => `${publicScheme()}://${consoleHost()}`;
