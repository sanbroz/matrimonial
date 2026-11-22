import { resolveFavicon } from "@/lib/favicon-server";

export const dynamic = "force-dynamic";

/** The browser-tab icon: the bureau's own (on a bureau address), else the platform's, else the built-in one. */
export async function GET() {
  const f = await resolveFavicon(true);
  if (f?.data) {
    return new Response(new Uint8Array(f.data), {
      headers: {
        "Content-Type": f.type,
        // Pages link ?v=<version>, so a new upload shows at once
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  // Relative: behind the proxy the request URL is the internal address (0.0.0.0:3000)
  return new Response(null, { status: 302, headers: { Location: "/favicon.ico", "Cache-Control": "no-store" } });
}
