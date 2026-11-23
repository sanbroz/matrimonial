import Link from "next/link";
import { requireUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { Alert, ButtonLink, Card, buttonClass, cx } from "@/components/ui";
import { ageFrom, formatDateTime } from "@/lib/format";
import { fileUrl } from "@/lib/storage";
import { FollowUpDoneButton } from "@/components/follow-up-done";
import { needsAttention } from "@/lib/proposal-labels";
import { collections, currentMonth, openDues, renewalsDue } from "@/lib/services/reports";
import { pendingMatches, upcomingBirthdays } from "@/lib/services/matching";
import { rupees } from "@/lib/money";
import { getWhatsAppStatus } from "@/lib/services/whatsapp";
import { currentDemoCounts } from "@/lib/services/demo";
import { bureauFeatures } from "@/lib/services/workflow";
import { GettingStarted } from "@/components/getting-started";

export const metadata = { title: "Dashboard" };

const SHOW_PENDING = 8;

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string; all?: string; off?: string }> }) {
  const user = await requireUser();
  const { denied, all, off } = await searchParams;
  const features = await bureauFeatures();
  const isOwner = user.role === "OWNER";
  // End of today in India time (IST = UTC+5:30), whatever the server's timezone
  const IST = 330 * 60000;
  const istNow = new Date(Date.now() + IST);
  const endOfToday = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate(), 23, 59, 59, 999) - IST);

  const birthdays = await upcomingBirthdays(7);
  const [leadsToCall, due, openProposals, pending, dues, renewals, monthPayments, wa, demo] = await Promise.all([
    prisma.lead.count({ where: { status: { in: ["NEW", "FOLLOW_UP"] } } }),
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
    pendingMatches(),
    openDues(),
    renewalsDue(),
    isOwner ? collections(currentMonth()) : Promise.resolve([]),
    isOwner ? getWhatsAppStatus() : Promise.resolve(null),
    currentDemoCounts(),
  ]);
  const callBack = openProposals.filter((p) => needsAttention(p)).length;
  const outstanding = dues.reduce((s, d) => s + d.balance, 0);
  const collected = monthPayments.filter((p) => !p.voidedAt).reduce((s, p) => s + p.amount, 0);

  // Today's numbers: each one is something to act on, and opens the list behind it
  const stats = [
    { label: "Profiles to share matches with", value: pending.length, href: "#to-share", strong: pending.length > 0 },
    ...(features.pipeline ? [{ label: "Families to call back", value: callBack, href: "/pipeline?attention=1", alert: callBack > 0 }] : []),
    { label: "Leads to call", value: leadsToCall, href: "/leads" },
    ...(features.payments && user.can.payments
      ? [{ label: `Dues outstanding${dues.length ? ` (${dues.length})` : ""}`, value: rupees(outstanding), href: "/payments", alert: outstanding > 0 }]
      : []),
    ...(isOwner && features.payments ? [{ label: "Collected this month", value: rupees(collected), href: "/payments?tab=collections" }] : []),
  ];

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Namaste, {user.name.split(" ")[0]}</h1>
          <p className="text-sm text-zinc-500">Here&apos;s what needs doing today.</p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/leads/new">Add lead</ButtonLink>
          <ButtonLink href="/profiles/new" variant="primary">Add profile</ButtonLink>
        </div>
      </div>

      {isOwner && <GettingStarted whatsappLinked={wa?.status === "open"} />}

      <div className="mb-4 space-y-2 empty:hidden">
        {denied && (
          <Alert tone="amber">
            {denied === "1" ? "That page is for the owner only." : `Your account can't open that page (${denied}). Ask the owner to allow it in Settings → Staff.`}
          </Alert>
        )}
        {off && (
          <Alert tone="amber">
            {off} is switched off for this bureau.{isOwner && <> Switch it on in <Link href="/settings/features" className="font-medium underline">Settings → Features</Link>.</>}
          </Alert>
        )}
        {demo.any && (
          <Alert tone="amber">
            This CRM contains <strong>demo data</strong> ({demo.profiles} sample profiles) to try things out.{" "}
            {isOwner ? (
              <>When you&apos;re ready for your real clients, <Link href="/settings/demo" className="font-medium underline">delete the demo data</Link>.</>
            ) : (
              <>The owner can delete it in Settings → Demo data.</>
            )}
          </Alert>
        )}
        {isOwner && wa && (wa.status === "closed" || (wa.status === "not_linked" && wa.lastError)) && (
          <Alert>
            WhatsApp is disconnected. <Link href="/settings/whatsapp" className="font-medium underline">Link the bureau number again</Link>
          </Alert>
        )}
        {features.payments && renewals.length > 0 && (
          <Alert tone="amber">
            {renewals.length} membership{renewals.length === 1 ? "" : "s"} to renew.{" "}
            <Link href="/payments" className="font-medium underline">See payments</Link>
          </Alert>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))]">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className={cx(
              "rounded-lg border bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow",
              s.strong ? "border-brand-200" : "border-zinc-200",
            )}
          >
            <div className={cx("text-2xl font-semibold", s.alert ? "text-red-600" : s.strong ? "text-brand-700" : "text-zinc-900")}>{s.value}</div>
            <div className="text-sm text-zinc-500">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div id="to-share" className="min-w-0 scroll-mt-4">
          <Card
            title={`Profiles with matches to share (${pending.length})`}
            actions={
              pending.length > SHOW_PENDING ? (
                <Link href={all ? "/#to-share" : "/?all=1#to-share"} className="text-sm text-brand-700 hover:underline">{all ? "Show fewer" : "See all"}</Link>
              ) : null
            }
          >
            {pending.length === 0 ? (
              <p className="text-sm text-zinc-500">
                All caught up: every active profile has been sent its suggested matches. New matches appear here as profiles are added.
              </p>
            ) : (
              <>
                <p className="mb-2 text-xs text-zinc-500">Suggested matches not yet shared with the family. Urgent and longest-waiting first.</p>
                <ul className="divide-y divide-zinc-100">
                  {(all ? pending : pending.slice(0, SHOW_PENDING)).map((p) => {
                    const age = ageFrom(p.dob);
                    const waited = p.lastSharedAt ? Math.floor((Date.now() - p.lastSharedAt.getTime()) / 86400000) : null;
                    return (
                      <li key={p.id} className="flex items-center gap-3 py-2.5">
                        {p.photoPath ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={fileUrl(p.photoPath)} alt="" className="size-10 shrink-0 rounded-full object-cover" />
                        ) : (
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs text-zinc-500">
                            {p.gender === "MALE" ? "G" : "B"}
                          </span>
                        )}
                        <Link href={`/profiles/${p.id}`} className="min-w-0 flex-1 hover:text-brand-700">
                          <span className="flex items-baseline gap-2">
                            <span className="font-mono text-xs text-brand-700">{p.code}</span>
                            <span className="truncate font-medium">{p.fullName}</span>
                          </span>
                          <span className="block truncate text-xs text-zinc-500">
                            {p.urgent && <span className="font-semibold text-red-600">Urgent · </span>}
                            {[age != null ? `${age} yrs` : null, [p.religion, p.caste].filter(Boolean).join(" "), p.country && p.country !== "India" ? p.country : p.city]
                              .filter(Boolean)
                              .join(" · ")}
                            {" · "}
                            {waited == null ? "nothing sent yet" : waited === 0 ? "last sent today" : `last sent ${waited} day${waited === 1 ? "" : "s"} ago`}
                          </span>
                        </Link>
                        <Link href={`/profiles/${p.id}/matches`} className={cx(buttonClass.secondary, "shrink-0 gap-2")}>
                          <span className="rounded-full bg-brand-50 px-2 text-xs font-semibold text-brand-700">{p.count}</span>
                          Share
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
        <Card title={`Follow-ups due today (${due.length})`}>
          {due.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing due.</p>
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
                        <span className={overdue ? "text-red-600" : ""}>{formatDateTime(f.dueAt)}{overdue && " (overdue)"}</span>
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
        {birthdays.length > 0 && (
          <Card title={`Birthdays this week (${birthdays.length})`}>
            <ul className="divide-y divide-zinc-100 text-sm">
              {birthdays.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/profiles/${b.id}`} className="hover:text-brand-700">
                    <span className="font-mono text-xs text-brand-700">{b.code}</span> {b.fullName}
                  </Link>
                  <span className="text-xs text-zinc-500">
                    {b.inDays === 0 ? "today 🎂" : b.inDays === 1 ? "tomorrow" : `in ${b.inDays} days`} · turns {b.turns}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-zinc-500">A good moment to send wishes, and their age on the biodata goes up.</p>
          </Card>
        )}
        </div>
      </div>
    </>
  );
}
