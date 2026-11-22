import "server-only";
import { exportTenantBackup } from "./backups";

/** Handles the download form POST (file + password) for one bureau's backup. */
export async function backupDownloadResponse(req: Request, slug: string): Promise<Response> {
  // Only from our own pages (a cross-site form could otherwise trigger a download with a known password)
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return new Response("Forbidden", { status: 403 });
  const fd = await req.formData();
  const file = String(fd.get("file") ?? "");
  const password = String(fd.get("password") ?? "");
  if (!/^[a-z0-9_-]+\.tar\.enc$/.test(file) || !file.startsWith(`${slug}_`)) return new Response("Bad file", { status: 400 });
  if (password.length < 8) return new Response("The password needs at least 8 characters. Go back and try again.", { status: 400 });
  try {
    const r = await exportTenantBackup(slug, file, password);
    const name = file.replace(/\.tar\.enc$/, ".7z");
    return new Response(r.body, {
      headers: {
        "Content-Type": "application/x-7z-compressed",
        "Content-Disposition": `attachment; filename="${name}"`,
        ...(r.headers.get("content-length") ? { "Content-Length": r.headers.get("content-length")! } : {}),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return new Response(`Download failed: ${e instanceof Error ? e.message : e}`, { status: 502 });
  }
}
