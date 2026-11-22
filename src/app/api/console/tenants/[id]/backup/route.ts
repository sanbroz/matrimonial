import { getConsoleAdmin } from "@/lib/auth/server";
import { getTenantById } from "@/lib/tenant/registry";
import { backupDownloadResponse } from "@/lib/backup-download";

export const dynamic = "force-dynamic";

/** Super admin: download one of a bureau's backups as a password-protected .7z (form POST). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getConsoleAdmin())) return new Response("Not signed in", { status: 401 });
  const t = await getTenantById((await params).id);
  if (!t) return new Response("Not found", { status: 404 });
  return backupDownloadResponse(req, t.slug);
}
