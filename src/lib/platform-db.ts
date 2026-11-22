import "server-only";
import { PrismaClient as PlatformClient } from "@/generated/platform";
import { databaseUrlFor } from "./tenant/db-url";

/** The platform database (super admins, bureaus, billing): schema "platform". */
const g = globalThis as unknown as { __platformDb?: PlatformClient };
export const platform = (g.__platformDb ??= new PlatformClient({ datasourceUrl: databaseUrlFor("platform", 5) }));

export type { Tenant, TenantStatus, BillingCycle, SuperAdmin, TenantPayment, TenantDomain } from "@/generated/platform";
