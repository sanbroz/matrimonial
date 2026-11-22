import { getConsoleAdmin } from "@/lib/auth/server";
import { getUpdateStatus, startUpdate } from "@/lib/updater";
import { getWhatsAppLibrary } from "@/lib/services/whatsapp";
import { appVersion } from "@/lib/version";

export const dynamic = "force-dynamic";

/** Super admin: app version, app update and WhatsApp library update availability. POST: start the app update. */
export async function GET() {
  if (!(await getConsoleAdmin())) return Response.json({ error: "Not signed in" }, { status: 401 });
  const [status, lib] = await Promise.all([getUpdateStatus(), getWhatsAppLibrary()]);
  const whatsapp = lib?.updateAvailable ? { installed: lib.installed, latest: lib.latest } : null;
  return Response.json({ ...(status ?? { running: appVersion, updateAvailable: false, unavailable: true }), whatsapp });
}

export async function POST(req: Request) {
  // Only from the console's own pages (blocks cross-site requests)
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return Response.json({ error: "Forbidden" }, { status: 403 });
  if (!(await getConsoleAdmin())) return Response.json({ error: "Not signed in" }, { status: 401 });
  const r = await startUpdate();
  return Response.json(r, { status: r.ok ? 202 : 409 });
}
