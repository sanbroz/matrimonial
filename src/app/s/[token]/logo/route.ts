import { prisma } from "@/lib/db";
import { readUpload } from "@/lib/storage";
import { findActiveShareLink } from "@/lib/services/share";
import { currentTenant } from "@/lib/tenant/context";

export const dynamic = "force-dynamic";

/** The bureau logo on a share link's pages. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const tenant = await currentTenant();
  if (!tenant || tenant.status === "SUSPENDED") return new Response("Not found", { status: 404 });
  const link = await findActiveShareLink((await params).token);
  if (!link) return new Response("Not found", { status: 404 });
  const s = await prisma.settings.findUnique({ where: { id: 1 }, select: { logoPath: true } });
  const file = s?.logoPath ? await readUpload(s.logoPath).catch(() => null) : null;
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: { "Content-Type": file.type, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
