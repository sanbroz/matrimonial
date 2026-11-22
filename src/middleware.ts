import { NextResponse, type NextRequest } from "next/server";
import { CONSOLE_COOKIE, SESSION_COOKIE, verifyConsoleSession, verifySession } from "@/lib/auth/session";
import { classifyHost, effectiveHost } from "@/lib/tenant/host";

/**
 * Routes each request by host and does a fast login check. First line of defence only:
 * every page, action and route also checks the user (and the bureau) on the server.
 *
 *   console host  (bureau.<domain>)  → /console/* pages (and / → /console), super admin login
 *   bureau hosts  (<slug>.<domain> or a custom domain) → the bureau app
 *
 * Pages and actions find their bureau from the same address themselves (src/lib/tenant/context.ts).
 */
const TENANT_PUBLIC = [
  /^\/login$/,
  /^\/forgot$/,
  /^\/reset\//,
  /^\/suspended$/,
  /^\/api\/health$/,
  /^\/api\/favicon$/,
  // Share links (checked by the page / routes themselves)
  /^\/s\/[A-Za-z0-9_-]+(\/(p\/[a-z0-9]+|logo))?$/,
];
const CONSOLE_PUBLIC = [/^\/console\/login$/];

export async function middleware(req: NextRequest) {
  const host = effectiveHost((n) => req.headers.get(n));
  const kind = classifyHost(host);
  const path = req.nextUrl.pathname;

  // Health check (Docker, uptime monitors) and the browser-tab icon work on any host
  if (path === "/api/health" || path === "/api/favicon") return NextResponse.next();
  if (kind.kind === "invalid") return new NextResponse("Not found", { status: 404 });

  if (kind.kind === "console") {
    // The console lives at real /console/* paths (no rewrites: server-action redirects bypass them)
    if (path === "/") return redirectTo(req, "/console");
    const isApi = path.startsWith("/api/console/");
    if (!isApi && path !== "/console" && !path.startsWith("/console/")) return new NextResponse("Not found", { status: 404 });
    if (!CONSOLE_PUBLIC.some((r) => r.test(path))) {
      const session = await verifyConsoleSession(req.cookies.get(CONSOLE_COOKIE)?.value);
      if (!session) {
        if (isApi) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
        return redirectTo(req, "/console/login");
      }
    }
    return NextResponse.next();
  }

  // Bureau host: console pages don't exist here
  if (path.startsWith("/console") || path.startsWith("/api/console")) return new NextResponse("Not found", { status: 404 });
  if (TENANT_PUBLIC.some((r) => r.test(path))) return NextResponse.next();
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();
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
