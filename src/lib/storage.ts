import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Local-disk storage for photos, kundli files and the bureau logo.
 * Files live OUTSIDE /public and are only served through /api/files (login required).
 * Swap this module for S3/R2 when hosting in the cloud; callers only use these functions.
 */
const ROOT = path.resolve(process.env.UPLOAD_DIR || "./storage/uploads");

export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
export const DOC_TYPES: Record<string, string> = { ...IMAGE_TYPES, "application/pdf": ".pdf" };

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export class UploadError extends Error {}

/** Saves a file and returns its storage key (relative path with forward slashes). */
export async function saveUpload(file: File, folder: string, allowed: Record<string, string>): Promise<string> {
  if (!file || file.size === 0) throw new UploadError("No file chosen");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("File is larger than 10 MB");
  const ext = allowed[file.type];
  if (!ext) throw new UploadError(`File type not allowed (${file.type || "unknown"})`);
  const safeFolder = folder.replace(/[^a-zA-Z0-9_\-/]/g, "");
  const key = `${safeFolder}/${randomUUID()}${ext}`;
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, Buffer.from(await file.arrayBuffer()));
  return key;
}

export async function readUpload(key: string): Promise<{ data: Buffer; type: string } | null> {
  const full = resolveKey(key);
  try {
    const data = await readFile(full);
    const ext = path.extname(full).toLowerCase();
    const type = Object.entries(DOC_TYPES).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
    return { data, type };
  } catch {
    return null;
  }
}

export async function deleteUpload(key: string | null | undefined) {
  if (!key) return;
  try {
    await unlink(resolveKey(key));
  } catch {
    /* already gone */
  }
}

/** Resolve a key inside ROOT; rejects path traversal. */
function resolveKey(key: string): string {
  const full = path.resolve(ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) throw new UploadError("Invalid file path");
  return full;
}

export const fileUrl = (key: string) => `/api/files/${key}`;
