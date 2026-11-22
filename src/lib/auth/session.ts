/**
 * Signed session cookie (HS256 JWT). Edge-safe: no Node or Prisma imports,
 * so middleware can use it. Middleware only does a fast token check — every
 * page, server action and route handler re-checks via requireUser()/requireOwner().
 */
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "mb_session";
/** Super admin console login (on the console host only) */
export const CONSOLE_COOKIE = "mb_console";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
  uid: string;
  role: "OWNER" | "STAFF";
  /** User.tokenVersion at login; a password change/reset raises it and ends older sessions. */
  tv: number;
  /** Bureau (tenant) id: a cookie from one bureau is refused on another */
  tid: string;
}

export interface ConsoleSessionPayload {
  /** SuperAdmin id */
  aid: string;
  tv: number;
}

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload, typ: "tenant" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (payload.typ !== "tenant" || typeof payload.uid !== "string" || typeof payload.tid !== "string") return null;
    return {
      uid: payload.uid,
      role: payload.role === "OWNER" ? "OWNER" : "STAFF",
      tv: typeof payload.tv === "number" ? payload.tv : 0,
      tid: payload.tid,
    };
  } catch {
    return null;
  }
}

export async function signConsoleSession(payload: ConsoleSessionPayload): Promise<string> {
  return new SignJWT({ ...payload, typ: "console" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(key());
}

export async function verifyConsoleSession(token: string | undefined): Promise<ConsoleSessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (payload.typ !== "console" || typeof payload.aid !== "string") return null;
    return { aid: payload.aid, tv: typeof payload.tv === "number" ? payload.tv : 0 };
  } catch {
    return null;
  }
}
