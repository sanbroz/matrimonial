import "server-only";
import { PrismaClient } from "@prisma/client";
import { notFound } from "next/navigation";
import { currentTenant } from "./tenant/context";
import { databaseUrlFor } from "./tenant/db-url";

/**
 * Bureau data. Each bureau has its own PostgreSQL schema and its own Prisma client.
 *
 * `prisma` is a stand-in that resolves the CURRENT bureau (from the request's host, or from
 * runAsTenant() in background jobs) on every call, so the existing code `prisma.profile.findMany(...)`
 * always reads the right bureau. Outside a bureau (console, unknown host) it answers 404, never a
 * default bureau. Use interactive transactions (`prisma.$transaction(async (tx) => …)`); the array
 * form is not supported.
 */

const IDLE_MS = 10 * 60_000;
const PER_TENANT_CONNECTIONS = Number(process.env.TENANT_DB_CONNECTIONS || 3);

type Entry = { client: PrismaClient; lastUsed: number };
const g = globalThis as unknown as { __tenantClients?: Map<string, Entry>; __tenantClientSweep?: NodeJS.Timeout };
const clients = (g.__tenantClients ??= new Map());

g.__tenantClientSweep ??= setInterval(() => {
  const now = Date.now();
  for (const [schema, e] of clients) {
    if (now - e.lastUsed > IDLE_MS) {
      clients.delete(schema);
      e.client.$disconnect().catch(() => {});
    }
  }
}, 60_000).unref();

/** Prisma client for one bureau schema (cached; idle clients are closed). */
export function clientForSchema(schema: string): PrismaClient {
  let e = clients.get(schema);
  if (!e) {
    e = { client: new PrismaClient({ datasourceUrl: databaseUrlFor(schema, PER_TENANT_CONNECTIONS) }), lastUsed: Date.now() };
    clients.set(schema, e);
  }
  e.lastUsed = Date.now();
  return e.client;
}

/** Close a bureau's connections (after a restore or delete). */
export async function dropClient(schema: string) {
  const e = clients.get(schema);
  clients.delete(schema);
  await e?.client.$disconnect().catch(() => {});
}

/** The current bureau's client. */
export async function db(): Promise<PrismaClient> {
  const t = await currentTenant();
  if (!t) notFound();
  return clientForSchema(t.schema);
}

const delegateCache = new Map<string | symbol, unknown>();

function lazyDelegate(model: string | symbol) {
  return new Proxy(
    {},
    {
      get(_t, method) {
        if (method === "then") return undefined; // not a promise
        return (...args: unknown[]) =>
          db().then((c) => {
            const delegate = (c as unknown as Record<string | symbol, Record<string | symbol, (...a: unknown[]) => unknown>>)[model];
            return delegate[method](...args);
          });
      },
    },
  );
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    if (prop === "then") return undefined;
    if (typeof prop === "string" && prop.startsWith("$")) {
      if (prop === "$transaction") {
        return (arg: unknown, opts?: unknown) => {
          if (typeof arg !== "function") throw new Error("Use an interactive transaction: prisma.$transaction(async (tx) => …)");
          return db().then((c) => c.$transaction(arg as Parameters<PrismaClient["$transaction"]>[0] & ((tx: unknown) => Promise<unknown>), opts as never));
        };
      }
      return (...args: unknown[]) =>
        db().then((c) => (c as unknown as Record<string, (...a: unknown[]) => unknown>)[prop](...args));
    }
    let d = delegateCache.get(prop);
    if (!d) delegateCache.set(prop, (d = lazyDelegate(prop)));
    return d;
  },
});
