import { platform } from "@/lib/platform-db";

export const dynamic = "force-dynamic";

/** The browser-tab icon for the console and every bureau (uploaded in the console); the built-in one otherwise. */
export async function GET(req: Request) {
  try {
    const s = await platform.platformSettings.findUnique({ where: { id: 1 }, select: { favicon: true, faviconType: true } });
    if (s?.favicon && s.faviconType) {
      return new Response(new Uint8Array(s.favicon), {
        headers: {
          "Content-Type": s.faviconType,
          // The page links ?v=<version>, so a new upload shows at once
          "Cache-Control": "public, max-age=86400",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
  } catch {
    /* database not reachable: fall back */
  }
  return Response.redirect(new URL("/favicon.ico", req.url), 302);
}
