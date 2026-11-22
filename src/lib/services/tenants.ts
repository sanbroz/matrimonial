import "server-only";
import { mkdir, rm } from "node:fs/promises";
import { platform } from "@/lib/platform-db";
import { clientForSchema, dropClient } from "@/lib/db";
import { uploadsRootFor } from "@/lib/storage";
import { backupsConfigured, takeTenantBackup } from "@/lib/backups";
import { dropSchema, migrateSchema, schemaExists } from "@/lib/tenant/migrate";
import { schemaForSlug, slugError } from "@/lib/tenant/host";
import { invalidateTenantCache } from "@/lib/tenant/registry";
import { createFirstOwner, seedBureauDefaults } from "@/lib/tenant/seed";
import { removeWhatsAppSession } from "./whatsapp";

export class TenantError extends Error {}

/**
 * Creates a bureau: its database schema (all migrations), default data, the first owner login
 * and its upload folder. Then registers it, so its subdomain starts working.
 */
export async function createTenant(input: {
  slug: string;
  name: string;
  status: "TRIAL" | "ACTIVE";
  owner: { name: string; email: string; password: string };
}) {
  const slug = input.slug.toLowerCase().trim();
  const err = slugError(slug);
  if (err) throw new TenantError(err);
  if (await platform.tenant.findUnique({ where: { slug } })) throw new TenantError(`"${slug}" is already used by another bureau.`);
  const schema = schemaForSlug(slug);
  if (await schemaExists(schema)) throw new TenantError(`Database section ${schema} already exists. Choose another subdomain.`);

  try {
    await migrateSchema(schema);
    const db = clientForSchema(schema);
    await seedBureauDefaults(db, input.name);
    await createFirstOwner(db, input.owner);
    await mkdir(uploadsRootFor(slug), { recursive: true });
  } catch (e) {
    await dropClient(schema);
    await dropSchema(schema).catch(() => {});
    throw e;
  }
  const t = await platform.tenant.create({ data: { slug, name: input.name, schema, status: input.status } });
  invalidateTenantCache();
  return t;
}

/** Deletes a bureau for good: final backup first (in production), then data, files and WhatsApp session. */
export async function deleteTenant(id: string) {
  const t = await platform.tenant.findUnique({ where: { id } });
  if (!t) return null;
  let finalBackup: string | null = null;
  if (backupsConfigured) finalBackup = await takeTenantBackup(t, "final");
  // Unregister first so the subdomain stops answering at once
  await platform.tenant.delete({ where: { id } });
  invalidateTenantCache();
  await dropClient(t.schema);
  await dropSchema(t.schema);
  await rm(uploadsRootFor(t.slug), { recursive: true, force: true });
  await removeWhatsAppSession(t.slug);
  return { slug: t.slug, finalBackup };
}
