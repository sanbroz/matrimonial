import Link from "next/link";
import { requireUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { Alert, Card, PageHeader, ButtonLink } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { FollowUpDoneButton } from "@/components/follow-up-done";
import { needsAttention } from "@/lib/proposal-labels";
import { collections, currentMonth, openDues, renewalsDue } from "@/lib/services/reports";
import { rupees } from "@/lib/money";

export const metadata = { title: "Dashboard" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const { denied } = await searchParams;
  // End of today in India time (IST = UTC+5:30), whatever the server's timezone
  const IST = 330 * 60000;
  const istNow = new Date(Date.now() + IST);
  const endOfToday = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate(), 23, 59, 59, 999) - IST);

  const [newLeads, followLeads, active, matched, due, openProposals, meetings] = await Promise.all([
    prisma.lead.count({ where: { status: "NEW" } }),
    prisma.lead.count({ where: { status: "FOLLOW_UP" } }),
    prisma.profile.count({ where: { status: "ACTIVE" } }),
    prisma.profile.count({ where: { status: "MATCHED" } }),
    prisma.followUp.findMany({
      where: { done: false, dueAt: { lte: endOfToday } },
      orderBy: { dueAt: "asc" },
      take: 50,
      include: {
        lead: { select: { id: true, name: true, phone: true } },
        profile: { select: { id: true, code: true, fullName: true, phone: true } },
      },
    }),
    prisma.proposal.findMany({
      where: { status: { in: ["SHARED", "INTERESTED", "MEETING_SCHEDULED", "MET"] } },
      select: { status: true, updatedAt: true, meetingAt: true },
    }),
    prisma.proposal.findMany({
      where: { status: "MEETING_SCHEDULED", meetingAt: { gte: new Date(Date.now() - 86400000), lte: new Date(Date.now() + 7 * 86400000) } },
      orderBy: { meetingAt: "asc" },
      include: {
        fromProfile: { select: { id: true, code: true, fullName: true } },
        toProfile: { select: { id: true, code: true, fullName: true } },
      },
    }),
  ]);
  const attention = openProposals.filter((p) => needsAttention(p)).length;
  const isOwner = user.role === "OWNER";
  const [dues, renewals, monthPayments] = await Promise.all([
    openDues(),
    renewalsDue(),
    isOwner ? collections(currentMonth()) : Promise.resolve([]),
  ]);
  const outstanding = dues.reduce((s, d) => s + d.balance, 0);
  const collected = monthPayments.filter((p) => !p.voidedAt).reduce((s, p) => s + p.amount, 0);

  const stats = [
    { label: "New leads", value: newLeads, href: "/leads?status=NEW" },
    { label: "Leads to follow up", value: followLeads, href: "/leads?status=FOLLOW_UP" },
    { label: "Active profiles", value: active, href: "/profiles?status=ACTIVE" },
    { label: "Proposals in progress", value: openProposals.length, href: "/pipeline" },
    { label: "Proposals needing a call", value: attention, href: "/pipeline?attention=1", alert: attention > 0 },
    { label: "Matched", value: matched, href: "/profiles?status=MATCHED" },
    { label: `Outstanding dues (${dues.length})`, value: rupees(outstanding), href: "/payments", alert: outstanding > 0 },
    { label: "Memberships to renew", value: renewals.length, href: "/payments", alert: renewals.length > 0 },
    ...(isOwner ? [{ label: "Collected this month", value: rupees(collected), href: "/payments?tab=collections" }] : []),
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        actions={
          <>
            <ButtonLink href="/leads/new">Add lead</ButtonLink>
            <ButtonLink href="/profiles/new" variant="primary">Add profile</ButtonLink>
          </>
        }
      />
      {denied && <div className="mb-4"><Alert tone="amber">That page is for the owner only.</Alert></div>}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm hover:border-brand-200">
            <div className={s.alert ? "text-2xl font-semibold text-red-600" : "text-2xl font-semibold"}>{s.value}</div>
            <div className="text-sm text-zinc-500">{s.label}</div>
          </Link>
        ))}
      </div>

      {meetings.length > 0 && (
        <Card title={`Meetings this week (${meetings.length})`} className="mb-5">
          <ul className="divide-y divide-zinc-100">
            {meetings.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <Link href={`/profiles/${m.fromProfile.id}`} className="hover:text-brand-700">
                    <span className="font-mono text-xs text-brand-700">{m.fromProfile.code}</span> {m.fromProfile.fullName}
                  </Link>
                  <span className="text-zinc-400"> &amp; </span>
                  <Link href={`/profiles/${m.toProfile.id}`} className="hover:text-brand-700">
                    <span className="font-mono text-xs text-brand-700">{m.toProfile.code}</span> {m.toProfile.fullName}
                  </Link>
                </span>
                <span className="text-zinc-600">{formatDateTime(m.meetingAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title={`Follow-ups due today (${due.length})`}>
        {due.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing due. </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {due.map((f) => {
              const who = f.profile
                ? { href: `/profiles/${f.profile.id}`, name: `${f.profile.code} · ${f.profile.fullName}`, phone: f.profile.phone }
                : f.lead
                  ? { href: `/leads/${f.lead.id}`, name: `Lead · ${f.lead.name}`, phone: f.lead.phone }
                  : null;
              const overdue = f.dueAt < new Date();
              return (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{f.title}</div>
                    <div className="text-xs text-zinc-500">
                      <span className={overdue ? "text-red-600" : ""}>{formatDateTime(f.dueAt)}</span>
                      {who && (
                        <>
                          {" · "}
                          <Link href={who.href} className="text-brand-700 hover:underline">{who.name}</Link>
                          {who.phone && <> · <a href={`tel:${who.phone}`}>{who.phone}</a></>}
                        </>
                      )}
                    </div>
                  </div>
                  <FollowUpDoneButton id={f.id} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
