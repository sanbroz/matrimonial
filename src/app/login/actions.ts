"use server";

import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/auth/session";
import { loginLimits } from "@/lib/auth/rate-limit";

/**
 * Client IP for the login limiter.
 * - Behind Cloudflare Tunnel (CLIENT_IP_HEADER=cf-connecting-ip): Cloudflare's header holds the visitor's IP.
 *   Safe because the app's port is only reachable through the tunnel.
 * - Otherwise the LAST X-Forwarded-For entry, which our own proxy (Caddy) added, so it can't be spoofed.
 */
async function clientIp() {
  const h = await headers();
  const trusted = process.env.CLIENT_IP_HEADER?.toLowerCase();
  if (trusted) {
    const v = h.get(trusted);
    if (v) return v.split(",")[0].trim();
  }
  const xff = h.get("x-forwarded-for");
  return xff ? xff.split(",").pop()!.trim() : "local";
}

// Compared against when the email doesn't exist, so response time doesn't reveal valid emails
const DUMMY_HASH = "$2b$10$jPc0LyIrKDV8zfasxi6jgO7Sfa0R5yqB9/8o5sqelufJ.mNcJoov.";

export async function loginAction(_prev: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const ip = await clientIp();
  const wait = Math.max(loginLimits.email.blockedFor(email), loginLimits.ip.blockedFor(ip));
  if (wait > 0) return { error: `Too many failed attempts. Try again in ${Math.ceil(wait / 60000)} minutes.` };

  const user = await prisma.user.findUnique({ where: { email } });
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.active || !passwordOk) {
    loginLimits.email.fail(email);
    loginLimits.ip.fail(ip);
    return { error: "Wrong email or password." };
  }
  loginLimits.email.reset(email);

  const token = await signSession({ uid: user.id, role: user.role });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect("/");
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
