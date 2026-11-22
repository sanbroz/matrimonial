import { NextResponse, type NextRequest } from "next/server";
import { CONSOLE_COOKIE, SESSION_COOKIE, verifyConsoleSession, verifySession } from "@/lib/auth/session";
import { classifyHost, normalizeHost } from "@/lib/tenant/host";

/**
 * Routes each request by host and does a fast login check. First line of defence only:
 * every page, action and route also checks the user (and the bureau) on the server.
 *
 *   console host  (bureau.<domain>)  → /console/* pages, super admin login
 *   bureau hosts  (<slug>.<domain> or a custom domain) → the bureau app
 *
 * The x-mb-host / x-mb-area headers are always overwritten here, so a browser can't fake them.
 */
const TENANT_PUBLIC = [/^\/login$/, /^\/forgot$/, /^\/reset\//, /^\/suspended$/, /^\/api\/health$/];
const CONSOLE_PUBLIC = [/^\/login$/, /^\/api\/health$/];

export async function middleware(req: NextRequest) {
  const host = normalizeHost(req.headers.get("host"));
  const kind = classifyHost(host);
  const path = req.nextUrl.pathname;
  const fwd = new Headers(req.headers);
  fwd.set("x-mb-host", host);
  fwd.set("x-mb-area", kind.kind === "console" ? "console" : "tenant");

  // Health check (Docker, uptime monitors) works on any host
  if (path === "/api/health") return NextResponse.next({ request: { headers: fwd } });
  if (kind.kind === "invalid") return new NextResponse("Not found", { status: 404 });

  if (kind.kind === "console") {
    if (path.startsWith("/console")) return new NextResponse("Not found", { status: 404 });
    const isApi = path.startsWith("/api/");
    if (isApi && !path.startsWith("/api/console/")) return new NextResponse("Not found", { status: 404 });
    if (!CONSOLE_PUBLIC.some((r) => r.test(path))) {
      const session = await verifyConsoleSession(req.cookies.get(CONSOLE_COOKIE)?.value);
      if (!session) {
        if (isApi) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
        return redirectTo(req, "/login");
      }
    }
    if (isApi) return NextResponse.next({ request: { headers: fwd } });
    const url = req.nextUrl.clone();
    url.pathname = `/console${path === "/" ? "" : path}`;
    return NextResponse.rewrite(url, { request: { headers: fwd } });
  }

  // Bureau host: console pages don't exist here
  if (path.startsWith("/console") || path.startsWith("/api/console")) return new NextResponse("Not found", { status: 404 });
  if (TENANT_PUBLIC.some((r) => r.test(path))) return NextResponse.next({ request: { headers: fwd } });
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next({ request: { headers: fwd } });
  if (path.startsWith("/api/")) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return redirectTo(req, "/login");
}

function redirectTo(req: NextRequest, pathname: string) {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
