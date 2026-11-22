import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { classifyHost } from "./host";
import { tenantForHost, type TenantInfo } from "./registry";

/**
 * The request's own Host header. Not a header added by middleware: after a server action, Next.js
 * renders the redirect target inside the same request WITHOUT running middleware, so middleware-added
 * headers are missing there (the user then looked signed out and landed on the dashboard).
 */
async function requestHost(): Promise<string | null> {
  try {
    return (await headers()).get("host");
  } catch {
    return null; // not inside a request
  }
}

const g = globalThis as unknown as { __tenantAls?: AsyncLocalStorage<TenantInfo> };
const als = (g.__tenantAls ??= new AsyncLocalStorage<TenantInfo>());

/** Run code for one bureau outside a web request (scheduler, jobs). */
export function runAsTenant<T>(tenant: TenantInfo, fn: () => Promise<T>): Promise<T> {
  return als.run(tenant, fn);
}

/** The bureau of the current request or job, or null (console, unknown host, no request). */
export async function currentTenant(): Promise<TenantInfo | null> {
  const store = als.getStore();
  if (store) return store;
  const host = await requestHost();
  return host ? tenantForHost(host) : null;
}

/** For bureau pages and actions: 404 on a host that isn't a bureau. */
export async function requireTenant(): Promise<TenantInfo> {
  const t = await currentTenant();
  if (!t) notFound();
  return t;
}

/** True when the request is on the super admin console host. */
export async function isConsoleRequest(): Promise<boolean> {
  const host = await requestHost();
  return !!host && classifyHost(host).kind === "console";
}
