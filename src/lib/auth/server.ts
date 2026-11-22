import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { platform } from "@/lib/platform-db";
import { currentTenant, isConsoleRequest } from "@/lib/tenant/context";
import { CONSOLE_COOKIE, SESSION_COOKIE, verifyConsoleSession, verifySession } from "./session";

export type CurrentUser = { id: string; name: string; email: string; role: "OWNER" | "STAFF" };

/**
 * Reads the cookie and re-loads the user, so deactivated staff lose access immediately.
 * The cookie must belong to THIS bureau (the host's tenant), and the bureau must not be suspended.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const tenant = await currentTenant();
  if (!tenant || tenant.status === "SUSPENDED") return null;
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session || session.tid !== tenant.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.uid },
    select: { id: true, name: true, email: true, role: true, active: true, tokenVersion: true },
  });
  if (!user || !user.active || user.tokenVersion !== session.tv) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
});

/** For pages and server actions: redirects to /login when not signed in. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const tenant = await currentTenant();
    if (tenant?.status === "SUSPENDED") redirect("/suspended");
    redirect("/login");
  }
  return user;
}

/** Owner-only pages and actions. */
export async function requireOwner(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "OWNER") redirect("/?denied=1");
  return user;
}

// ───────────── Super admin console ─────────────

export type ConsoleAdmin = { id: string; name: string; email: string };

export const getConsoleAdmin = cache(async (): Promise<ConsoleAdmin | null> => {
  if (!(await isConsoleRequest())) return null; // console cookies are only valid on the console host
  const session = await verifyConsoleSession((await cookies()).get(CONSOLE_COOKIE)?.value);
  if (!session) return null;
  const a = await platform.superAdmin.findUnique({
    where: { id: session.aid },
    select: { id: true, name: true, email: true, active: true, tokenVersion: true },
  });
  if (!a || !a.active || a.tokenVersion !== session.tv) return null;
  return { id: a.id, name: a.name, email: a.email };
});

export async function requireConsoleAdmin(): Promise<ConsoleAdmin> {
  const a = await getConsoleAdmin();
  if (!a) redirect("/login");
  return a;
}
