import { prisma } from "@/lib/db";
import { readUpload } from "@/lib/storage";
import { findActiveShareLink } from "@/lib/services/share";
import { currentTenant } from "@/lib/tenant/context";

export const dynamic = "force-dynamic";

/** A biodata photo for a share link: only photos marked for the biodata, of profiles in the link, while it works. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string; photoId: string }> }) {
  const tenant = await currentTenant();
  if (!tenant || tenant.status === "SUSPENDED") return new Response("Not found", { status: 404 });
  const { token, photoId } = await params;
  const link = await findActiveShareLink(token);
  if (!link || !link.sections.includes("photo")) return new Response("Not found", { status: 404 });
  const photo = await prisma.photo.findUnique({ where: { id: photoId }, select: { path: true, profileId: true, onBiodata: true } });
  if (!photo || !photo.onBiodata || !link.profileIds.includes(photo.profileId)) return new Response("Not found", { status: 404 });
  const file = await readUpload(photo.path).catch(() => null);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: { "Content-Type": file.type, "Cache-Control": "private, max-age=600", "X-Content-Type-Options": "nosniff" },
  });
}
