/**
 * Signed session cookie (HS256 JWT). Edge-safe: no Node or Prisma imports,
 * so middleware can use it. Middleware only does a fast token check — every
 * page, server action and route handler re-checks via requireUser()/requireOwner().
 */
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "mb_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
  uid: string;
  role: "OWNER" | "STAFF";
  /** User.tokenVersion at login; a password change/reset raises it and ends older sessions. */
  tv: number;
}

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (typeof payload.uid !== "string") return null;
    return {
      uid: payload.uid,
      role: payload.role === "OWNER" ? "OWNER" : "STAFF",
      tv: typeof payload.tv === "number" ? payload.tv : 0,
    };
  } catch {
    return null;
  }
}
