"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { setSessionCookie } from "@/lib/auth/cookie";
import { loginLimits } from "@/lib/auth/rate-limit";
import { clientIp } from "@/lib/auth/client-ip";

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

  await setSessionCookie(user);
  redirect("/");
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
