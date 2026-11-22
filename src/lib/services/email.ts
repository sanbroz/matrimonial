import "server-only";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";
import { readEmailConfig } from "@/lib/email-config";
import { open } from "@/lib/secret-box";

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  /** Optional HTML version; plain text is always included. */
  html?: string;
  attachments?: EmailAttachment[];
  kind: string;
  profileId?: string | null;
  userId?: string | null;
}

export type SendResult = { ok: true; id?: string } | { ok: false; error: string };

async function loadTransport() {
  const s = await prisma.settings.findUniqueOrThrow({ where: { id: 1 }, select: { emailConfig: true, bureauName: true } });
  return transportFor(s.emailConfig, s.bureauName);
}

/** SMTP transport from a stored email config (a bureau's, or the platform's). */
export function transportFor(emailConfig: unknown, defaultFromName: string) {
  const cfg = readEmailConfig(emailConfig);
  if (!cfg.enabled || !cfg.user || !cfg.passwordSealed) return { error: "Email is not set up (Settings → Email)" } as const;
  const pass = open(cfg.passwordSealed);
  if (!pass) return { error: "The saved email password can't be read. Enter it again in Settings → Email." } as const;
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  return { transport, from: { name: cfg.fromName || defaultFromName, address: cfg.user } } as const;
}

export async function isEmailConfigured(): Promise<boolean> {
  const s = await prisma.settings.findUnique({ where: { id: 1 }, select: { emailConfig: true } });
  const c = readEmailConfig(s?.emailConfig);
  return c.enabled && !!c.user && !!c.passwordSealed;
}

/** Sends one email and logs it (success or failure) in OutboundMessage. */
export async function sendEmail(input: SendEmailInput): Promise<SendResult> {
  const to = input.to.trim();
  let result: SendResult;
  if (!/^\S+@\S+\.\S+$/.test(to)) {
    result = { ok: false, error: `"${to}" is not an email address` };
  } else {
    const t = await loadTransport();
    if ("error" in t) {
      result = { ok: false, error: t.error ?? "Email not set up" };
    } else {
      try {
        const info = await t.transport.sendMail({
          from: t.from,
          to,
          subject: input.subject,
          text: input.text,
          html: input.html,
          attachments: input.attachments,
        });
        result = { ok: true, id: info.messageId };
      } catch (e) {
        result = { ok: false, error: friendlySmtpError(e) };
      }
    }
  }
  await prisma.outboundMessage.create({
    data: {
      channel: "EMAIL",
      kind: input.kind,
      to,
      subject: input.subject,
      // never store reset links in the log
      body: input.kind === "password_reset" ? "(password reset link)" : input.text.slice(0, 4000),
      hasAttachment: !!input.attachments?.length,
      status: result.ok ? "SENT" : "FAILED",
      error: result.ok ? null : result.error,
      externalId: result.ok ? (result.id ?? null) : null,
      profileId: input.profileId ?? null,
      createdById: input.userId ?? null,
    },
  });
  return result;
}

export function friendlySmtpError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/Invalid login|Username and Password not accepted|535/i.test(msg))
    return "Gmail refused the login. Use a Gmail App Password (not your normal password) and check the address.";
  if (/ETIMEDOUT|ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i.test(msg)) return "Could not reach the mail server. Check the internet connection.";
  return msg.slice(0, 300);
}

/** Minimal HTML version of a plain-text email (keeps line breaks, escapes HTML). */
export function textToHtml(text: string): string {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.5;color:#222">${esc.replace(/\n/g, "<br>")}</div>`;
}
