import Link from "next/link";
import { requireUser } from "@/lib/auth/server";
import { collections, currentMonth, openDues, renewalsDue } from "@/lib/services/reports";
import { KIND_LABELS, MODE_LABELS, daysLeft, rupees } from "@/lib/money";
import { formatDateOnly, formatDateTime } from "@/lib/format";
import { Alert, Badge, ButtonLink, Card, EmptyState, PageHeader, buttonClass, cx, inputClass } from "@/components/ui";

import { SendMessageButton } from "@/components/send-message";
import { sendReminder } from "@/lib/actions/messaging";
import { addressee, messageContext } from "@/lib/services/message-vars";
import { whatsappConfigured } from "@/lib/services/whatsapp";
import { renderTemplate } from "@/lib/templates";

export const metadata = { title: "Payments" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ tab?: string; month?: string; ok?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const isOwner = user.role === "OWNER";
  const tab = sp.tab === "collections" && isOwner ? "collections" : "dues";

  return (
    <>
      <PageHeader title="Payments" subtitle="Payments are recorded on each profile. Open a profile to start a membership or receive a payment." />
      {sp.ok && <div className="mb-4"><Alert tone="green">{sp.ok}</Alert></div>}
      <div className="mb-5 flex gap-1 border-b border-zinc-200">
        {[
          ["dues", "Dues & renewals"],
          ...(isOwner ? [["collections", "Collections"]] : []),
        ].map(([k, l]) => (
          <Link
            key={k}
            href={`/payments?tab=${k}`}
            className={cx("-mb-px border-b-2 px-3 py-2 text-sm font-medium", tab === k ? "border-brand-600 text-brand-700" : "border-transparent text-zinc-600 hover:text-zinc-900")}
          >
            {l}
          </Link>
        ))}
      </div>
      {tab === "dues" ? <DuesTab /> : <CollectionsTab month={sp.month} />}
    </>
  );
}

async function DuesTab() {
  const [dues, renewals, ctx] = await Promise.all([openDues(), renewalsDue(), messageContext()]);
  const total = dues.reduce((s, d) => s + d.balance, 0);
  const age = (d: Date) => Math.floor((Date.now() - d.getTime()) / 86400000);

  return (
    <div className="space-y-5">
      <Card title={<>Outstanding dues: {rupees(total)} <span className="font-normal text-zinc-500">({dues.length})</span></>}>
        {dues.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing outstanding.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-zinc-500">
                <tr><th className="py-1 pr-3">Client</th><th className="py-1 pr-3">For</th><th className="py-1 pr-3">Since</th><th className="py-1 pr-3 text-right">Balance</th><th /></tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {dues.map((d) => (
                  <tr key={d.id}>
                    <td className="py-2 pr-3">
                      <Link href={`/profiles/${d.profile.id}#money`} className="hover:text-brand-700">
                        <span className="font-mono text-xs text-brand-700">{d.profile.code}</span> {d.profile.fullName}
                      </Link>
                      {d.profile.phone && <a href={`tel:${d.profile.phone}`} className="block text-xs text-zinc-500">{d.profile.phone}</a>}
                    </td>
                    <td className="py-2 pr-3">{d.label}</td>
                    <td className="py-2 pr-3 text-zinc-600">
                      {formatDateOnly(d.createdAt)}
                      {age(d.createdAt) > 30 && <span className="ml-1"><Badge tone="red">{age(d.createdAt)} days</Badge></span>}
                    </td>
                    <td className="py-2 pr-3 text-right font-medium">{rupees(d.balance)}</td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <SendMessageButton
                          channel="whatsapp"
                          label="Remind"
                          title={`Payment reminder: ${d.profile.code}`}
                          action={sendReminder}
                          defaultTo={d.profile.phone}
                          defaultText={renderTemplate(ctx.templates.paymentDue, {
                            ...ctx.base, name: addressee(d.profile), code: d.profile.code, amount: rupees(d.balance), for: d.label,
                          })}
                          fields={{ kind: "payment_due", profileId: d.profile.id }}
                          disabledReason={!whatsappConfigured ? "WhatsApp is available on the production server" : d.profile.phone ? null : "No phone number"}
                        />
                        <ButtonLink href={`/profiles/${d.profile.id}#money`}>Receive</ButtonLink>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={`Memberships to renew (${renewals.length})`}>
        {renewals.length === 0 ? (
          <p className="text-sm text-zinc-500">No memberships ending in the next 14 days or expired in the last 30.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {renewals.map((m) => {
              const left = daysLeft(m.endDate);
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                  <Link href={`/profiles/${m.profile.id}#money`} className="min-w-0 flex-1 hover:text-brand-700">
                    <span className="font-mono text-xs text-brand-700">{m.profile.code}</span> {m.profile.fullName}
                    <span className="block text-xs text-zinc-500">{m.plan.name} · ends {formatDateOnly(m.endDate)}{m.profile.phone && ` · ${m.profile.phone}`}</span>
                  </Link>
                  {left < 0 ? <Badge tone="red">Expired {-left} days ago</Badge> : <Badge tone="amber">{left === 0 ? "Ends today" : `${left} days left`}</Badge>}
                  <SendMessageButton
                    channel="whatsapp"
                    label="Remind"
                    title={`Renewal reminder: ${m.profile.code}`}
                    action={sendReminder}
                    defaultTo={m.profile.phone}
                    defaultText={renderTemplate(ctx.templates.renewal, {
                      ...ctx.base, name: addressee(m.profile), code: m.profile.code, plan: m.plan.name, end_date: formatDateOnly(m.endDate),
                    })}
                    fields={{ kind: "renewal", profileId: m.profile.id }}
                    disabledReason={!whatsappConfigured ? "WhatsApp is available on the production server" : m.profile.phone ? null : "No phone number"}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

async function CollectionsTab({ month: monthParam }: { month?: string }) {
  const month = /^\d{4}-\d{2}$/.test(monthParam ?? "") ? monthParam! : currentMonth();
  const payments = await collections(month);
  const valid = payments.filter((p) => !p.voidedAt);
  const total = valid.reduce((s, p) => s + p.amount, 0);
  const sumBy = <K extends string>(key: (p: (typeof valid)[number]) => K) =>
    valid.reduce<Record<string, number>>((acc, p) => ((acc[key(p)] = (acc[key(p)] ?? 0) + p.amount), acc), {});
  const byMode = sumBy((p) => p.mode);
  const byKind = sumBy((p) => p.kind);
  const label = new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-5">
      <form className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value="collections" />
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Month</span>
          <input type="month" name="month" defaultValue={month} className={inputClass + " w-44!"} />
        </label>
        <button className={buttonClass.secondary}>Show</button>
        <a href={`/api/payments-csv?month=${month}`} className={buttonClass.ghost}>Download CSV</a>
      </form>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={`Collected in ${label}`} value={rupees(total)} strong />
        <Stat label="Receipts" value={String(valid.length)} />
        {Object.entries(byMode).map(([m, v]) => <Stat key={m} label={MODE_LABELS[m as keyof typeof MODE_LABELS]} value={rupees(v)} />)}
      </div>
      {Object.keys(byKind).length > 0 && (
        <p className="text-sm text-zinc-600">
          By type: {Object.entries(byKind).map(([k, v]) => `${KIND_LABELS[k as keyof typeof KIND_LABELS]} ${rupees(v)}`).join(" · ")}
        </p>
      )}

      {payments.length === 0 ? (
        <EmptyState>No receipts in {label}.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
              <tr><th className="px-3 py-2">Receipt</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Client</th><th className="px-3 py-2">For</th><th className="px-3 py-2">Mode</th><th className="px-3 py-2">By</th><th className="px-3 py-2 text-right">Amount</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {payments.map((p) => (
                <tr key={p.id} className={cx(p.voidedAt && "text-zinc-400")}>
                  <td className="px-3 py-2"><Link href={`/payments/${p.id}/receipt`} className="font-mono text-brand-700 hover:underline">{p.receiptNo}</Link></td>
                  <td className="px-3 py-2">{formatDateTime(p.paidAt)}</td>
                  <td className="px-3 py-2">
                    {p.profileId ? <Link href={`/profiles/${p.profileId}#money`} className="hover:text-brand-700"><span className="font-mono text-xs">{p.profileCode}</span> {p.payerName}</Link> : <><span className="font-mono text-xs">{p.profileCode}</span> {p.payerName}</>}
                  </td>
                  <td className="px-3 py-2">{p.description}{p.voidedAt && <span className="ml-1"><Badge tone="red">Void</Badge></span>}</td>
                  <td className="px-3 py-2">{MODE_LABELS[p.mode]}{p.reference && ` · ${p.reference}`}</td>
                  <td className="px-3 py-2 text-zinc-500">{p.createdBy.name}</td>
                  <td className={cx("px-3 py-2 text-right font-medium", p.voidedAt && "line-through")}>{rupees(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className={cx("text-xl font-semibold", strong && "text-brand-700")}>{value}</div>
      <div className="text-sm text-zinc-500">{label}</div>
    </div>
  );
}
