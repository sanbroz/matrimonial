import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "./session";

/** Issue the login cookie for a user (used at sign-in and after changing one's own password). */
export async function setSessionCookie(user: { id: string; role: "OWNER" | "STAFF"; tokenVersion: number }) {
  const token = await signSession({ uid: user.id, role: user.role, tv: user.tokenVersion });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}
