"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { setSessionCookie } from "@/lib/auth/cookie";
import { loginLimits } from "@/lib/auth/rate-limit";
import { clientIp } from "@/lib/auth/client-ip";
import { requireTenant } from "@/lib/tenant/context";

// Compared against when the email doesn't exist, so response time doesn't reveal valid emails
const DUMMY_HASH = "$2b$10$jPc0LyIrKDV8zfasxi6jgO7Sfa0R5yqB9/8o5sqelufJ.mNcJoov.";

export async function loginAction(_prev: { error?: string; email?: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password.", email };
  const tenant = await requireTenant();
  if (tenant.status === "SUSPENDED") redirect("/suspended");

  const ip = await clientIp();
  const key = `${tenant.id}:${email}`; // limits are per bureau
  const wait = Math.max(loginLimits.email.blockedFor(key), loginLimits.ip.blockedFor(`${tenant.id}:${ip}`));
  if (wait > 0) return { error: `Too many failed attempts. Try again in ${Math.ceil(wait / 60000)} minutes.`, email };
  // Count the attempt BEFORE checking the password, so many parallel attempts can't all slip
  // through while the (slow) password check runs. Taken back below if it succeeds.
  loginLimits.email.fail(key);
  loginLimits.ip.fail(`${tenant.id}:${ip}`);

  const user = await prisma.user.findUnique({ where: { email } });
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.active || !passwordOk) {
    return { error: "Wrong email or password.", email };
  }
  loginLimits.email.reset(key);
  loginLimits.ip.undo(`${tenant.id}:${ip}`);

  await setSessionCookie(user);
  redirect("/");
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
