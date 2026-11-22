import "server-only";
import { platform } from "@/lib/platform-db";
import { readEmailConfig } from "@/lib/email-config";
import { friendlySmtpError, transportFor } from "./email";

/** Emails from the platform (to super admins): uses the console's own Gmail settings. */
export async function isPlatformEmailConfigured(): Promise<boolean> {
  const s = await platform.platformSettings.findUnique({ where: { id: 1 }, select: { emailConfig: true } });
  const c = readEmailConfig(s?.emailConfig);
  return c.enabled && !!c.user && !!c.passwordSealed;
}

export async function sendPlatformEmail(input: { to: string; subject: string; text: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = await platform.platformSettings.findUnique({ where: { id: 1 }, select: { emailConfig: true } });
  const t = transportFor(s?.emailConfig, "Bureau platform");
  if ("error" in t) return { ok: false, error: t.error ?? "Email not set up" };
  try {
    await t.transport.sendMail({ from: t.from, to: input.to, subject: input.subject, text: input.text });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlySmtpError(e) };
  }
}

/** Sends to every active super admin; returns how many got it. */
export async function emailSuperAdmins(subject: string, text: string): Promise<number> {
  if (!(await isPlatformEmailConfigured())) return 0;
  const admins = await platform.superAdmin.findMany({ where: { active: true }, select: { email: true } });
  let n = 0;
  for (const a of admins) {
    const r = await sendPlatformEmail({ to: a.email, subject, text });
    if (r.ok) n++;
    else console.error(`[platform-email] to ${a.email} failed: ${r.error}`);
  }
  return n;
}
