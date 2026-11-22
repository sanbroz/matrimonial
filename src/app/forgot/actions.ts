"use server";

import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { appBaseUrl, clientIp } from "@/lib/auth/client-ip";
import { loginLimits } from "@/lib/auth/rate-limit";
import { isEmailConfigured, sendEmail } from "@/lib/services/email";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

/**
 * "Forgot password": always answers the same way, so it never reveals which emails have accounts.
 * Uses the login limiter so it can't be used to flood an inbox.
 */
export async function requestReset(_prev: { done?: boolean; error?: string } | undefined, fd: FormData) {
  const email = String(fd.get("email") ?? "").toLowerCase().trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter your email address." };
  const ip = await clientIp();
  if (loginLimits.email.blockedFor(`reset:${email}`) || loginLimits.ip.blockedFor(`reset:${ip}`)) {
    return { error: "Too many requests. Please try again later." };
  }
  loginLimits.email.fail(`reset:${email}`);
  loginLimits.ip.fail(`reset:${ip}`);

  const base = await appBaseUrl();
  if (!(await isEmailConfigured()) || !base) {
    if (!base) console.error("[reset] APP_URL is not set in .env.production; password reset emails are disabled");
    return { error: "Password reset by email isn't set up yet. Ask the owner to reset your password in Settings → Staff." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && user.active) {
    const token = randomBytes(32).toString("base64url");
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
    });
    const link = `${base}/reset/${token}`;
    await sendEmail({
      to: user.email,
      subject: "Reset your password",
      text:
        `Hello ${user.name},\n\nSomeone (hopefully you) asked to reset the password for ${user.email}.\n` +
        `Open this link within 1 hour to choose a new password:\n\n${link}\n\n` +
        `If you didn't ask for this, ignore this email. Your password stays the same.`,
      kind: "password_reset",
      userId: user.id,
    });
  }
  return { done: true };
}

export async function resetPassword(token: string, _prev: { error?: string } | undefined, fd: FormData) {
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (password.length < 8) return { error: "Use at least 8 characters." };
  if (password !== confirm) return { error: "The two passwords don't match." };

  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hash(token) }, include: { user: true } });
  if (!row || row.usedAt || row.expiresAt < new Date() || !row.user.active) {
    return { error: "This link has expired or was already used. Ask for a new one." };
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      // tokenVersion +1 signs the account out everywhere
      data: { passwordHash: await bcrypt.hash(password, 10), tokenVersion: { increment: 1 } },
    }),
    prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: row.userId, usedAt: null } }),
  ]);
  loginLimits.email.reset(row.user.email);
  redirect("/login?reset=1");
}
