import "server-only";
import { cookies } from "next/headers";
import { requireTenant } from "@/lib/tenant/context";
import { CONSOLE_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE, signConsoleSession, signSession } from "./session";

const cookieOpts = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});

/** Issue the login cookie for a bureau user (sign-in, and after changing one's own password). */
export async function setSessionCookie(user: { id: string; role: "OWNER" | "STAFF"; tokenVersion: number }) {
  const tenant = await requireTenant();
  const token = await signSession({ uid: user.id, role: user.role, tv: user.tokenVersion, tid: tenant.id });
  (await cookies()).set(SESSION_COOKIE, token, cookieOpts(SESSION_MAX_AGE));
}

/** Super admin console login cookie (host-only: never sent to bureau subdomains). */
export async function setConsoleCookie(admin: { id: string; tokenVersion: number }) {
  const token = await signConsoleSession({ aid: admin.id, tv: admin.tokenVersion });
  (await cookies()).set(CONSOLE_COOKIE, token, cookieOpts(12 * 3600));
}
