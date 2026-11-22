/**
 * Database setup and migrations for the whole platform. Runs on every deploy (tools container)
 * and locally with `npm run db:migrate-all`. Safe to run any number of times.
 *
 *  1. platform schema: migrations
 *  2. one-time move of a single-bureau install: schema "public" → "t_<FIRST_TENANT_SLUG>",
 *     uploaded files → <UPLOAD_DIR>/<slug>/, registered as the first bureau
 *  3. every bureau schema: migrations + default data
 *  4. the first super admin (SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD, else OWNER_EMAIL / OWNER_PASSWORD)
 */
import { chown, mkdir, readdir, rename } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaClient as PlatformClient } from "../src/generated/platform";
import { migrateSchema, PLATFORM_MIGRATIONS, withPg } from "../src/lib/tenant/migrate";
import { databaseUrlFor } from "../src/lib/tenant/db-url";
import { seedBureauDefaults } from "../src/lib/tenant/seed";
import { schemaForSlug } from "../src/lib/tenant/host";

const FIRST_SLUG = (process.env.FIRST_TENANT_SLUG || "matrimonial").toLowerCase();
const UPLOADS = path.resolve(process.env.UPLOAD_DIR || "./storage/uploads");

async function main() {
  const applied = await migrateSchema("platform", PLATFORM_MIGRATIONS);
  if (applied.length) console.log(`platform: applied ${applied.join(", ")}`);
  const platform = new PlatformClient({ datasourceUrl: databaseUrlFor("platform") });
  try {
    await platform.platformSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
    await convertSingleBureauInstall(platform);
    await moveLegacyUploads(platform);

    const tenants = await platform.tenant.findMany({ orderBy: { createdAt: "asc" } });
    for (const t of tenants) {
      const done = await migrateSchema(t.schema);
      const db = new PrismaClient({ datasourceUrl: databaseUrlFor(t.schema, 2) });
      try {
        await seedBureauDefaults(db, t.name);
      } finally {
        await db.$disconnect();
      }
      console.log(`${t.slug} (${t.schema}): ${done.length ? `applied ${done.join(", ")}` : "up to date"}`);
    }
    await ensureSuperAdmin(platform);
  } finally {
    await platform.$disconnect();
  }
  console.log("Migrations complete");
}

/** Single-bureau install (data in schema "public") → first bureau. One transaction: all or nothing. */
async function convertSingleBureauInstall(platform: PlatformClient) {
  if ((await platform.tenant.count()) > 0) return;
  const schema = schemaForSlug(FIRST_SLUG);
  const moved = await withPg(async (c) => {
    const hasData = (await c.query(`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Settings'`)).rowCount === 1;
    if (!hasData) return null;
    const name = (await c.query(`SELECT "bureauName" FROM public."Settings" WHERE id = 1`)).rows[0]?.bureauName ?? "Bureau";
    await c.query("BEGIN");
    try {
      await c.query(`ALTER SCHEMA public RENAME TO "${schema}"`);
      await c.query(`CREATE SCHEMA public`);
      await c.query(
        `INSERT INTO platform."Tenant" (id, slug, name, schema, status, fee, "billingCycle", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'ACTIVE', 0, 'MONTHLY', now(), now())`,
        [`tenant_${FIRST_SLUG}`, FIRST_SLUG, name, schema],
      );
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK").catch(() => {});
      throw e;
    }
    return name;
  });
  if (moved) console.log(`Moved the existing bureau "${moved}" into schema ${schema} as bureau "${FIRST_SLUG}"`);
}

/** Files of a single-bureau install sit directly in UPLOAD_DIR; they belong to the first bureau. */
async function moveLegacyUploads(platform: PlatformClient) {
  const first = await platform.tenant.findUnique({ where: { slug: FIRST_SLUG } });
  if (!first) return;
  const slugs = new Set((await platform.tenant.findMany({ select: { slug: true } })).map((t) => t.slug));
  let entries: string[];
  try {
    entries = await readdir(UPLOADS);
  } catch {
    return; // no uploads folder
  }
  const legacy = entries.filter((e) => !slugs.has(e) && !e.startsWith("."));
  if (!legacy.length) return;
  const target = path.join(UPLOADS, FIRST_SLUG);
  await mkdir(target, { recursive: true });
  // The tools container runs as root; the app runs as "node" (uid 1000) and must own its folder
  if (process.getuid?.() === 0) await chown(target, 1000, 1000);
  for (const e of legacy) await rename(path.join(UPLOADS, e), path.join(target, e));
  console.log(`Moved uploaded files (${legacy.join(", ")}) into ${target}`);
}

async function ensureSuperAdmin(platform: PlatformClient) {
  if ((await platform.superAdmin.count()) > 0) return;
  const email = (process.env.SUPERADMIN_EMAIL || process.env.OWNER_EMAIL || "").toLowerCase().trim();
  const password = process.env.SUPERADMIN_PASSWORD || process.env.OWNER_PASSWORD;
  if (!email || !password) throw new Error("Set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD (or OWNER_EMAIL / OWNER_PASSWORD)");
  await platform.superAdmin.create({
    data: { name: process.env.SUPERADMIN_NAME || "Super admin", email, passwordHash: await bcrypt.hash(password, 10) },
  });
  console.log(`Created super admin ${email} (sign in on the console; change the password after signing in)`);
}


main().catch((e) => {
  console.error(e);
  process.exit(1);
});
