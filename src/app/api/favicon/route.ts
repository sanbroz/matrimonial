import { platform } from "@/lib/platform-db";

export const dynamic = "force-dynamic";

/** The browser-tab icon for the console and every bureau (uploaded in the console); the built-in one otherwise. */
export async function GET() {
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
  // Relative: behind the proxy the request URL is the internal address (0.0.0.0:3000)
  return new Response(null, { status: 302, headers: { Location: "/favicon.ico", "Cache-Control": "no-store" } });
}
