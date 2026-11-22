import { getConsoleAdmin } from "@/lib/auth/server";
import { checkLibraryNow, getWhatsAppLibrary, listWhatsAppSessions } from "@/lib/services/whatsapp";
import { getBaileysRun, rollbackBaileys, startBaileysUpdate } from "@/lib/updater";

export const dynamic = "force-dynamic";

/** Super admin: WhatsApp library versions + update run. */
export async function GET() {
  if (!(await getConsoleAdmin())) return Response.json({ error: "Not signed in" }, { status: 401 });
  const [library, sessions, updater] = await Promise.all([getWhatsAppLibrary(), listWhatsAppSessions(), getBaileysRun()]);
  const open = sessions?.filter((s) => s.status === "open").length ?? 0;
  const connection = library ? (sessions?.length ? (open ? "open" : "closed") : "not_linked") : "unavailable";
  return Response.json({ connection, sessions: sessions ?? [], library, updater });
}

/** POST {action: "update", version} | {action: "rollback"} | {action: "check"} */
export async function POST(req: Request) {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return Response.json({ error: "Forbidden" }, { status: 403 });
  if (!(await getConsoleAdmin())) return Response.json({ error: "Not signed in" }, { status: 401 });
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
    const lib = await getWhatsAppLibrary();
    if (!lib?.latest || lib.latest !== body.version) {
      return Response.json({ ok: false, error: "That version isn't the latest release" }, { status: 409 });
    }
    const r = await startBaileysUpdate(body.version);
    return Response.json(r, { status: r.ok ? 202 : 409 });
  }
  return Response.json({ error: "Unknown action" }, { status: 400 });
}
