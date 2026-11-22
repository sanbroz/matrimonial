"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/auth/server";
import { readEmailConfig, summaryOptionsSchema } from "@/lib/email-config";
import { seal } from "@/lib/secret-box";
import { sendEmail } from "@/lib/services/email";
import { sendDailySummary } from "@/lib/services/summary";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const back = (msg: string, key: "ok" | "error" = "ok"): never => redirect(`/settings/email?${key}=${encodeURIComponent(msg)}`);

export async function saveEmailSettings(fd: FormData) {
  await requireOwner();
  const current = await prisma.settings.findUniqueOrThrow({ where: { id: 1 }, select: { emailConfig: true } });
  const cfg = readEmailConfig(current.emailConfig);

  const user = str(fd, "user").toLowerCase();
  if (user && !/^\S+@\S+\.\S+$/.test(user)) back("Enter a valid email address", "error");
  // App passwords are shown by Google in groups of four; spaces don't matter
  const password = str(fd, "password").replace(/\s+/g, "");
  const advanced = fd.get("advanced") === "on";
  const port = Number(str(fd, "port") || 465);

  const next = {
    enabled: fd.get("enabled") === "on",
    user,
    fromName: str(fd, "fromName"),
    host: advanced ? str(fd, "host") || "smtp.gmail.com" : "smtp.gmail.com",
    port: advanced && Number.isInteger(port) ? port : 465,
    secure: advanced ? fd.get("secure") === "on" : true,
    passwordSealed: password ? seal(password) : fd.get("clearPassword") === "on" ? null : cfg.passwordSealed,
  };
  if (next.enabled && (!next.user || !next.passwordSealed)) back("Enter the Gmail address and App Password to turn email on", "error");

  const summary = summaryOptionsSchema.parse({
    enabled: fd.get("summaryEnabled") === "on",
    time: str(fd, "summaryTime"),
    extraRecipients: str(fd, "summaryExtra").split(/[,\s]+/).filter(Boolean),
  });

  await prisma.settings.update({ where: { id: 1 }, data: { emailConfig: next, summaryOptions: summary } });
  revalidatePath("/settings/email");
  back("Email settings saved");
}

export async function sendTestEmail(fd: FormData) {
  const user = await requireOwner();
  const to = str(fd, "to");
  const r = await sendEmail({
    to,
    subject: "Test email from Bureau CRM",
    text: "This is a test email. If you can read it, email is set up correctly.",
    kind: "test",
    userId: user.id,
  });
  back(r.ok ? `Test email sent to ${to}` : `Test email failed: ${r.error}`, r.ok ? "ok" : "error");
}

export async function sendSummaryNow() {
  await requireOwner();
  const r = await sendDailySummary({ force: true });
  back(r.sent ? `Summary sent to ${r.recipients.join(", ")}` : `Summary not sent: ${r.reason}`, r.sent ? "ok" : "error");
}
