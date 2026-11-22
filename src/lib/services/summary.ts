import "server-only";
import { prisma } from "@/lib/db";
import { readSummaryOptions } from "@/lib/email-config";
import { formatDateTime } from "@/lib/format";
import { daysLeft, rupees } from "@/lib/money";
import { needsAttention } from "@/lib/proposal-labels";
import { isEmailConfigured, sendEmail } from "./email";
import { openDues, renewalsDue } from "./reports";
import { getWhatsAppStatus } from "./whatsapp";
import { currentTenant } from "@/lib/tenant/context";
import { tenantBaseUrl } from "@/lib/tenant/registry";
import { workflowSettings } from "./workflow";
import { pendingMatches } from "./matching";

const IST = 330 * 60000;

/** "YYYY-MM-DD" and HH:MM in India time. */
export function istNow(now = new Date()) {
  const d = new Date(now.getTime() + IST);
  return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) };
}

function istDayRange(offsetDays = 0, now = new Date()) {
  const { date } = istNow(now);
  const start = new Date(new Date(`${date}T00:00:00Z`).getTime() - IST + offsetDays * 86400000);
  return { start, end: new Date(start.getTime() + 86400000) };
}

export async function buildSummary(now = new Date()) {
  const today = istDayRange(0, now);
  const yesterday = istDayRange(-1, now);
  const [followUps, meetings, open, dues, renewals, newLeads, collected] = await Promise.all([
    prisma.followUp.findMany({
      where: { done: false, dueAt: { lt: today.end } },
      orderBy: { dueAt: "asc" },
      take: 30,
      include: { profile: { select: { code: true, fullName: true } }, lead: { select: { name: true } } },
    }),
    prisma.proposal.findMany({
      where: { status: "MEETING_SCHEDULED", meetingAt: { gte: today.start, lt: new Date(today.end.getTime() + 2 * 86400000) } },
      orderBy: { meetingAt: "asc" },
      include: { fromProfile: { select: { code: true } }, toProfile: { select: { code: true } } },
    }),
    prisma.proposal.findMany({
      where: { status: { in: ["SHARED", "INTERESTED", "MEETING_SCHEDULED", "MET"] } },
      select: { status: true, updatedAt: true, meetingAt: true },
    }),
    openDues(),
    renewalsDue(),
    prisma.lead.count({ where: { createdAt: { gte: yesterday.start, lt: yesterday.end } } }),
    prisma.payment.aggregate({ where: { voidedAt: null, paidAt: { gte: yesterday.start, lt: yesterday.end } }, _sum: { amount: true }, _count: true }),
  ]);
  const attention = open.filter((p) => needsAttention(p, now)).length;
  const outstanding = dues.reduce((s, d) => s + d.balance, 0);

  const lines: string[] = [];
  const section = (title: string, items: string[], empty: string) => {
    lines.push(`\n${title}`);
    lines.push(...(items.length ? items.map((i) => `  • ${i}`) : [`  ${empty}`]));
  };
  section(
    `Follow-ups due today (${followUps.length})`,
    followUps.map((f) => `${f.title}: ${f.profile ? `${f.profile.code} ${f.profile.fullName}` : f.lead ? `lead ${f.lead.name}` : ""} (${formatDateTime(f.dueAt)})`),
    "Nothing due.",
  );
  const { trackMeetings } = await workflowSettings();
  if (trackMeetings) {
    section(
      `Meetings in the next 3 days (${meetings.length})`,
      meetings.map((m) => `${m.fromProfile.code} & ${m.toProfile.code}: ${formatDateTime(m.meetingAt)}`),
      "None.",
    );
  }
  const pending = await pendingMatches();
  section(
    `Profiles with new matches to share (${pending.length})`,
    pending.slice(0, 10).map((p) => `${p.code} ${p.fullName}: ${p.count} match${p.count === 1 ? "" : "es"}`),
    "None: every active profile has been sent its matches.",
  );
  lines.push(`\nFamilies to call back about shared profiles: ${attention} (of ${open.length} waiting for a reply)`);
  section(
    `Outstanding dues: ${rupees(outstanding)} (${dues.length})`,
    dues.slice(0, 10).map((d) => `${d.profile.code} ${d.profile.fullName}: ${rupees(d.balance)} for ${d.label}`),
    "Nothing outstanding.",
  );
  section(
    `Memberships to renew (${renewals.length})`,
    renewals.map((m) => {
      const left = daysLeft(m.endDate);
      return `${m.profile.code} ${m.profile.fullName}: ${m.plan.name}, ${left < 0 ? `expired ${-left} days ago` : `${left} days left`}`;
    }),
    "None.",
  );
  lines.push(`\nYesterday: ${newLeads} new lead${newLeads === 1 ? "" : "s"}, ${rupees(collected._sum.amount ?? 0)} collected (${collected._count} receipts)`);

  const wa = await getWhatsAppStatus();
  if (wa.status === "closed" || (wa.status === "not_linked" && wa.lastError)) lines.push(`\nWhatsApp is DISCONNECTED: link the bureau number again in Settings → WhatsApp`);

  const tenant = await currentTenant();
  if (tenant) lines.push(`\nOpen the CRM: ${await tenantBaseUrl(tenant)}`);
  return lines.join("\n").trim();
}

/**
 * Sends the daily summary to all active owners (+ extra recipients).
 * Without force: only when enabled, at/after the configured time, once per day.
 */
export async function sendDailySummary({ force = false, now = new Date() } = {}): Promise<
  { sent: true; recipients: string[] } | { sent: false; reason: string; recipients: [] }
> {
  const s = await prisma.settings.findUniqueOrThrow({ where: { id: 1 }, select: { summaryOptions: true, lastSummaryDate: true, bureauName: true } });
  const opts = readSummaryOptions(s.summaryOptions);
  const { date, time } = istNow(now);
  if (!force) {
    if (!opts.enabled) return { sent: false, reason: "turned off", recipients: [] };
    if (time < opts.time) return { sent: false, reason: "not time yet", recipients: [] };
    if (s.lastSummaryDate === date) return { sent: false, reason: "already sent today", recipients: [] };
  }
  if (!(await isEmailConfigured())) return { sent: false, reason: "email is not set up", recipients: [] };

  // Claim today first so two overlapping runs can't both send
  if (!force) {
    const claimed = await prisma.settings.updateMany({
      where: { id: 1, OR: [{ lastSummaryDate: null }, { lastSummaryDate: { not: date } }] },
      data: { lastSummaryDate: date },
    });
    if (claimed.count === 0) return { sent: false, reason: "already sent today", recipients: [] };
  }

  const owners = await prisma.user.findMany({ where: { role: "OWNER", active: true }, select: { email: true } });
  const recipients = [...new Set([...owners.map((o) => o.email), ...opts.extraRecipients])];
  const text = await buildSummary(now);
  const pretty = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const sentTo: string[] = [];
  for (const to of recipients) {
    const r = await sendEmail({ to, subject: `${s.bureauName}: daily summary for ${pretty}`, text, kind: "summary" });
    if (r.ok) sentTo.push(to);
  }
  return sentTo.length ? { sent: true, recipients: sentTo } : { sent: false, reason: "sending failed (see Recent emails)", recipients: [] };
}
