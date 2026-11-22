import "server-only";
import { PrismaClient as PlatformClient } from "@/generated/platform";
import { databaseUrlFor } from "./tenant/db-url";

/** The platform database (super admins, bureaus, billing): schema "platform". */
const g = globalThis as unknown as { __platformDb?: PlatformClient };
// No DATABASE_URL while "next build" collects pages: the client is only used at request time
export const platform = (g.__platformDb ??= new PlatformClient(
  process.env.DATABASE_URL ? { datasourceUrl: databaseUrlFor("platform", 5) } : undefined,
));

export type { Tenant, TenantStatus, BillingCycle, SuperAdmin, TenantPayment, TenantDomain } from "@/generated/platform";
