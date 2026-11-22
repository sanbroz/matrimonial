import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { tenantForHost, type TenantInfo } from "./registry";

/** Set by middleware from the Host header (any value sent by the browser is overwritten). */
export const HOST_HEADER = "x-mb-host";
/** "console" or "tenant", also set by middleware */
export const AREA_HEADER = "x-mb-area";

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
  let host: string | null;
  try {
    host = (await headers()).get(HOST_HEADER);
  } catch {
    return null; // not inside a request
  }
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
  try {
    return (await headers()).get(AREA_HEADER) === "console";
  } catch {
    return false;
  }
}
