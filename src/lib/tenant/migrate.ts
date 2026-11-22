/**
 * Applies Prisma migration folders to one PostgreSQL schema, recording them in that schema's
 * `_prisma_migrations` table exactly like `prisma migrate deploy` does (same checksum), so the two
 * stay interchangeable. Used to create a new bureau from the console (the app image has no Prisma
 * CLI) and by ops/migrate-all.ts on every deploy.
 *
 * Plain Node (no Next.js imports): also run by tsx in the tools container.
 */
import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

export const TENANT_MIGRATIONS = path.resolve(process.cwd(), "prisma/migrations");
export const PLATFORM_MIGRATIONS = path.resolve(process.cwd(), "prisma/platform/migrations");

const SCHEMA_RE = /^[a-z_][a-z0-9_]{0,62}$/;

/** A pg connection string without Prisma-only parameters. */
export function pgUrl(databaseUrl = process.env.DATABASE_URL): string {
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  const u = new URL(databaseUrl);
  for (const k of ["schema", "connection_limit", "pool_timeout", "pgbouncer"]) u.searchParams.delete(k);
  return u.toString();
}

export async function withPg<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: pgUrl() });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end().catch(() => {});
  }
}

async function migrationNames(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory() && /^\d{14}_/.test(e.name)).map((e) => e.name).sort();
}

/** Creates the schema if needed and applies pending migrations. Returns the names applied. */
export async function migrateSchema(schema: string, migrationsDir = TENANT_MIGRATIONS): Promise<string[]> {
  if (!SCHEMA_RE.test(schema)) throw new Error(`Invalid schema name: ${schema}`);
  const names = await migrationNames(migrationsDir);
  return withPg(async (c) => {
    // One migrator per schema at a time (two app processes, or a deploy during a console action)
    const lock = createHash("sha256").update(`migrate:${schema}`).digest().readInt32BE(0);
    await c.query("SELECT pg_advisory_lock($1)", [lock]);
    try {
      await c.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
      await c.query(`SET search_path TO "${schema}"`);
      await c.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" VARCHAR(36) PRIMARY KEY NOT NULL,
        "checksum" VARCHAR(64) NOT NULL,
        "finished_at" TIMESTAMPTZ,
        "migration_name" VARCHAR(255) NOT NULL,
        "logs" TEXT,
        "rolled_back_at" TIMESTAMPTZ,
        "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0
      )`);
      const done = new Set(
        (await c.query(`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`)).rows.map(
          (r) => r.migration_name as string,
        ),
      );
      const failed = (await c.query(`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL`)).rows;
      if (failed.length) throw new Error(`Schema ${schema} has a failed migration (${failed[0].migration_name}); fix it before continuing`);
      const applied: string[] = [];
      for (const name of names) {
        if (done.has(name)) continue;
        const sql = await readFile(path.join(migrationsDir, name, "migration.sql"));
        const checksum = createHash("sha256").update(sql).digest("hex");
        await c.query("BEGIN");
        try {
          await c.query(sql.toString("utf8"));
          await c.query(
            `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, applied_steps_count) VALUES ($1, $2, now(), $3, 1)`,
            [randomUUID(), checksum, name],
          );
          await c.query("COMMIT");
        } catch (e) {
          await c.query("ROLLBACK").catch(() => {});
          throw new Error(`Migration ${name} failed on ${schema}: ${e instanceof Error ? e.message : e}`);
        }
        applied.push(name);
      }
      return applied;
    } finally {
      await c.query("SELECT pg_advisory_unlock($1)", [lock]).catch(() => {});
    }
  });
}

export async function schemaExists(schema: string): Promise<boolean> {
  return withPg(async (c) => (await c.query("SELECT 1 FROM information_schema.schemata WHERE schema_name = $1", [schema])).rowCount === 1);
}

export async function dropSchema(schema: string) {
  if (!SCHEMA_RE.test(schema) || ["public", "platform"].includes(schema)) throw new Error(`Refusing to drop schema ${schema}`);
  await withPg((c) => c.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`));
}
