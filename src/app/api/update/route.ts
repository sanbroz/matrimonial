import { getCurrentUser } from "@/lib/auth/server";
import { getUpdateStatus, startUpdate } from "@/lib/updater";
import { getWhatsAppStatus } from "@/lib/services/whatsapp";
import { appVersion } from "@/lib/version";

export const dynamic = "force-dynamic";

/** GET: version info (everyone) + app / WhatsApp library update availability (owner). POST: start app update (owner). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (user.role !== "OWNER") return Response.json({ running: appVersion });
  const [status, wa] = await Promise.all([getUpdateStatus(), getWhatsAppStatus()]);
  const whatsapp = wa.library?.updateAvailable ? { installed: wa.library.installed, latest: wa.library.latest } : null;
  return Response.json({ ...(status ?? { running: appVersion, updateAvailable: false, unavailable: true }), whatsapp });
}

export async function POST(req: Request) {
  // Only from the app's own pages (blocks cross-site requests)
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return Response.json({ error: "Forbidden" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (user.role !== "OWNER") return Response.json({ error: "Owner only" }, { status: 403 });
  const r = await startUpdate();
  return Response.json(r, { status: r.ok ? 202 : 409 });
}
