import { prisma } from "@/lib/db";
import { readUpload } from "@/lib/storage";
import { currentTenant } from "@/lib/tenant/context";

export const dynamic = "force-dynamic";

/** The bureau logo on its public enquiry form (only while the form is open). */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const tenant = await currentTenant();
  if (!tenant || tenant.status === "SUSPENDED") return new Response("Not found", { status: 404 });
  const form = await prisma.leadForm.findUnique({ where: { token: (await params).token }, select: { active: true } });
  if (!form?.active) return new Response("Not found", { status: 404 });
  const s = await prisma.settings.findUnique({ where: { id: 1 }, select: { logoPath: true } });
  const file = s?.logoPath ? await readUpload(s.logoPath).catch(() => null) : null;
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: { "Content-Type": file.type, "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
