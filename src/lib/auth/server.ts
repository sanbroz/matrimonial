import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "./session";

export type CurrentUser = { id: string; name: string; email: string; role: "OWNER" | "STAFF" };

/** Reads the cookie and re-loads the user, so deactivated staff lose access immediately. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.uid },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  if (!user || !user.active) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
});

/** For pages and server actions: redirects to /login when not signed in. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Owner-only pages and actions. */
export async function requireOwner(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "OWNER") redirect("/?denied=1");
  return user;
}
