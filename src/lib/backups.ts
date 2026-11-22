import "server-only";
import { dropClient } from "@/lib/db";
import { migrateSchema } from "@/lib/tenant/migrate";
import type { TenantInfo } from "@/lib/tenant/registry";

/** Client for the backup container's API (production only; the passphrase never leaves that container). */
const URL_ = process.env.BACKUP_URL;
const TOKEN = process.env.BACKUP_TOKEN;
export const backupsConfigured = !!(URL_ && TOKEN && TOKEN.length >= 32);
export const BACKUPS_UNAVAILABLE = "Backups run in the production installation (the backup service isn't part of this one).";

export interface BackupFile {
  file: string;
  size: number;
  created: string;
}

async function call(p: string, init?: RequestInit, timeoutMs = 10 * 60_000) {
  if (!backupsConfigured) throw new Error(BACKUPS_UNAVAILABLE);
  return fetch(`${URL_}${p}`, {
    ...init,
    headers: { "x-backup-token": TOKEN!, "content-type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function json<T>(r: Response): Promise<T> {
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error ?? `Backup service error ${r.status}`);
  return body as T;
}

export async function listFullBackups(): Promise<BackupFile[]> {
  return json(await call("/full", undefined, 15_000));
}

export async function takeFullBackup(): Promise<void> {
  await json(await call("/full", { method: "POST" }));
}

export async function listTenantBackups(slug: string): Promise<BackupFile[]> {
  return json(await call(`/t/${slug}`, undefined, 15_000));
}

export async function takeTenantBackup(t: Pick<TenantInfo, "slug" | "schema">, label = "manual"): Promise<string> {
  const r = await json<{ file: string }>(await call(`/t/${t.slug}/backup`, { method: "POST", body: JSON.stringify({ schema: t.schema, label }) }));
  return r.file;
}

/** Restores one bureau from one of its backups (a safety backup is taken first). Returns the safety file. */
export async function restoreTenantBackup(t: Pick<TenantInfo, "slug" | "schema">, file: string): Promise<string> {
  const r = await json<{ safety: string }>(await call(`/t/${t.slug}/restore`, { method: "POST", body: JSON.stringify({ schema: t.schema, file }) }));
  await dropClient(t.schema); // fresh connections for the restored data
  await migrateSchema(t.schema); // an older backup may predate newer app versions
  return r.safety;
}

/** Bureau deleted: its backups move to the platform's archive, so a new bureau on the same subdomain never sees them. */
export async function archiveTenantBackups(slug: string): Promise<void> {
  await json(await call(`/t/${slug}/archive`, { method: "POST", body: "{}" }, 60_000));
}

/** A password-protected .7z copy of one backup, streamed from the backup service. */
export async function exportTenantBackup(slug: string, file: string, password: string): Promise<Response> {
  const r = await call(`/t/${slug}/export`, { method: "POST", body: JSON.stringify({ file, password }) });
  if (!r.ok) await json(r);
  return r;
}

export const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
