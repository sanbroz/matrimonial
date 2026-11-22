import { getCurrentUser } from "@/lib/auth/server";
import { checkLibraryNow, getWhatsAppStatus } from "@/lib/services/whatsapp";
import { getBaileysRun, rollbackBaileys, startBaileysUpdate } from "@/lib/updater";

export const dynamic = "force-dynamic";

/** Owner only: WhatsApp library versions + update run. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (user.role !== "OWNER") return Response.json({ error: "Owner only" }, { status: 403 });
  const [wa, updater] = await Promise.all([getWhatsAppStatus(), getBaileysRun()]);
  return Response.json({ connection: wa.status, library: wa.library ?? null, updater });
}

/** POST {action: "update", version} | {action: "rollback"} | {action: "check"} */
export async function POST(req: Request) {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return Response.json({ error: "Forbidden" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (user.role !== "OWNER") return Response.json({ error: "Owner only" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (body.action === "check") {
    await checkLibraryNow();
    return Response.json({ ok: true });
  }
  if (body.action === "rollback") {
    const r = await rollbackBaileys();
    return Response.json(r, { status: r.ok ? 202 : 409 });
  }
  if (body.action === "update") {
    // Only the version the WhatsApp service itself reports as latest can be installed from here
    const wa = await getWhatsAppStatus();
    if (!wa.library?.latest || wa.library.latest !== body.version) {
      return Response.json({ ok: false, error: "That version isn't the latest release" }, { status: 409 });
    }
    const r = await startBaileysUpdate(body.version);
    return Response.json(r, { status: r.ok ? 202 : 409 });
  }
  return Response.json({ error: "Unknown action" }, { status: 400 });
}
