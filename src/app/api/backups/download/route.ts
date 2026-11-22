import { getCurrentUser } from "@/lib/auth/server";
import { requireTenant } from "@/lib/tenant/context";
import { backupDownloadResponse } from "@/lib/backup-download";

export const dynamic = "force-dynamic";

/** Bureau owner: download one of this bureau's own backups as a password-protected .7z (form POST). */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  if (user.role !== "OWNER") return new Response("Owner only", { status: 403 });
  const t = await requireTenant();
  return backupDownloadResponse(req, t.slug);
}
