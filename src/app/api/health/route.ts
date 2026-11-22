import { platform } from "@/lib/platform-db";

export const dynamic = "force-dynamic";

/** Public health check for uptime monitors and Docker: 200 when the app and database work. */
export async function GET() {
  try {
    await platform.$queryRaw`SELECT 1`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
