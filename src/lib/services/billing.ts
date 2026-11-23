import "server-only";
import { platform } from "@/lib/platform-db";
import { billingState, daysOverdue, shouldAutoSuspend } from "@/lib/billing";
import { readSummaryOptions } from "@/lib/email-config";
import { rupees } from "@/lib/money";
import { invalidateTenantCache } from "@/lib/tenant/registry";
import { emailSuperAdmins, isPlatformEmailConfigured } from "./platform-email";
import { istNow } from "./summary";
import { RetryGate } from "@/lib/retry-gate";

/** Today (India) as a UTC-midnight date, matching the @db.Date due dates. */
export const todayDate = (now = new Date()) => new Date(`${istNow(now).date}T00:00:00Z`);

/** Scheduler tick: automatic suspension of overdue bureaus, then the super admins' daily email. */
export async function billingTick(now = new Date()) {
  const today = todayDate(now);
  const candidates = await platform.tenant.findMany({
    where: { status: { not: "SUSPENDED" }, autoSuspendDays: { not: null }, nextDueDate: { not: null } },
    select: { id: true, slug: true, name: true, status: true, nextDueDate: true, autoSuspendDays: true },
  });
  const suspended: string[] = [];
  for (const t of candidates) {
    if (!shouldAutoSuspend(t, today)) continue;
    const r = await platform.tenant.updateMany({
      where: { id: t.id, status: { not: "SUSPENDED" } },
      data: { status: "SUSPENDED", suspendedReason: `Payment overdue since ${t.nextDueDate!.toISOString().slice(0, 10)}` },
    });
    if (r.count) suspended.push(`${t.name} (${t.slug})`);
  }
  if (suspended.length) {
    invalidateTenantCache();
    console.log(`[billing] suspended for non-payment: ${suspended.join(", ")}`);
    await emailSuperAdmins(`Suspended for non-payment: ${suspended.length} bureau(s)`, suspended.map((s) => `• ${s}`).join("\n"));
  }
  await sendPlatformSummary(now);
}

export async function buildPlatformSummary(now = new Date()) {
  const today = todayDate(now);
  const tenants = await platform.tenant.findMany({
    select: { name: true, slug: true, status: true, fee: true, nextDueDate: true },
    orderBy: { nextDueDate: "asc" },
  });
  const overdue = tenants.filter((t) => t.status !== "SUSPENDED" && billingState(t.nextDueDate, today) === "overdue");
  const soon = tenants.filter((t) => t.status !== "SUSPENDED" && billingState(t.nextDueDate, today) === "due_soon");
  const suspended = tenants.filter((t) => t.status === "SUSPENDED");
  const line = (t: (typeof tenants)[number]) =>
    `  • ${t.name} (${t.slug}): ${rupees(t.fee)}, due ${t.nextDueDate?.toISOString().slice(0, 10)}` +
    (t.nextDueDate ? `, ${Math.abs(daysOverdue(t.nextDueDate, today))} days ${daysOverdue(t.nextDueDate, today) > 0 ? "overdue" : "left"}` : "");
  return [
    `Bureaus: ${tenants.length} (${suspended.length} suspended)`,
    `\nOverdue (${overdue.length})`,
    ...(overdue.length ? overdue.map(line) : ["  None."]),
    `\nDue in the next 7 days (${soon.length})`,
    ...(soon.length ? soon.map(line) : ["  None."]),
  ].join("\n");
}

async function sendPlatformSummary(now: Date) {
  const s = await platform.platformSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 }, select: { summary: true, summarySentOn: true } });
  const opts = readSummaryOptions(s.summary);
  const { date, time } = istNow(now);
  if (!opts.enabled || time < opts.time || s.summarySentOn === date) return;
  if (!platformRetry.canTry("platform", date, now.getTime())) return;
  if (!(await isPlatformEmailConfigured())) return;
  const claimed = await platform.platformSettings.updateMany({
    where: { id: 1, OR: [{ summarySentOn: null }, { summarySentOn: { not: date } }] },
    data: { summarySentOn: date },
  });
  if (!claimed.count) return;
  let sent = 0;
  try {
    sent = await emailSuperAdmins(`Bureau platform: billing summary for ${date}`, await buildPlatformSummary(now));
  } finally {
    if (sent) platformRetry.succeeded("platform");
    else {
      // Nobody got it: give today back so a later tick retries (10, 30, 60, 120 minutes)
      await platform.platformSettings.updateMany({ where: { id: 1, summarySentOn: date }, data: { summarySentOn: s.summarySentOn } });
      const next = platformRetry.failed("platform", date, now.getTime());
      console.error(`[billing] platform summary not sent; ${next ? `retrying after ${next.toISOString()}` : "giving up for today"}`);
    }
  }
}

const gRetry = globalThis as unknown as { __platformSummaryRetry?: RetryGate };
const platformRetry = (gRetry.__platformSummaryRetry ??= new RetryGate());
