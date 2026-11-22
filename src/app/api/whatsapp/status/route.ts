import { getCurrentUser } from "@/lib/auth/server";
import { getWhatsAppStatus } from "@/lib/services/whatsapp";

export const dynamic = "force-dynamic";

/** Owner: full status incl. QR. Staff: only whether WhatsApp is connected. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const s = await getWhatsAppStatus();
  if (user.role !== "OWNER") return Response.json({ status: s.status });
  return Response.json(s);
}
