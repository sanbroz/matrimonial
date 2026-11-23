import Link from "next/link";
import { requirePermission } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { requireFeature } from "@/lib/services/workflow";
import { rupees } from "@/lib/money";
import { SOURCE_LABELS } from "@/lib/lead-labels";
import { Card, PageHeader, buttonClass, cx } from "@/components/ui";

export const metadata = { title: "Reports" };

type Row = { m: string; n: number };

/** Months in India time, newest first: "2026-11", "2026-10", … */
function lastMonths(count: number) {
  const now = new Date(Date.now() + 330 * 60000);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    return d.toISOString().slice(0, 7);
  });
}
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });

export default async function ReportsPage() {
  await requirePermission("reports");
  const features = await requireFeature("reports");
  const months = lastMonths(12);
  // Start of the oldest month in India time
  const since = new Date(new Date(`${months[months.length - 1]}-01T00:00:00Z`).getTime() - 330 * 60000);

  const [leads, profiles, shared, matched, collected, bySource, byForm] = await Promise.all([
    prisma.$queryRaw<Row[]>`SELECT to_char("createdAt" + interval '330 minutes', 'YYYY-MM') AS m, count(*)::int AS n FROM "Lead" WHERE "createdAt" >= ${since} AND NOT "isDemo" GROUP BY 1`,
    prisma.$queryRaw<Row[]>`SELECT to_char("createdAt" + interval '330 minutes', 'YYYY-MM') AS m, count(*)::int AS n FROM "Profile" WHERE "createdAt" >= ${since} AND NOT "isDemo" GROUP BY 1`,
    prisma.$queryRaw<Row[]>`SELECT to_char("createdAt" + interval '330 minutes', 'YYYY-MM') AS m, count(*)::int AS n FROM "Proposal" WHERE "createdAt" >= ${since} GROUP BY 1`,
    prisma.$queryRaw<Row[]>`SELECT to_char("matchedAt" + interval '330 minutes', 'YYYY-MM') AS m, count(*)::int AS n FROM "Proposal" WHERE status = 'MATCHED' AND "matchedAt" >= ${since} GROUP BY 1`,
    features.payments
      ? prisma.$queryRaw<Row[]>`SELECT to_char("paidAt" + interval '330 minutes', 'YYYY-MM') AS m, coalesce(sum(amount), 0)::int AS n FROM "Payment" WHERE "voidedAt" IS NULL AND "paidAt" >= ${since} GROUP BY 1`
      : Promise.resolve([] as Row[]),
    prisma.lead.groupBy({ by: ["source"], where: { createdAt: { gte: since }, isDemo: false }, _count: true }),
    prisma.leadForm.findMany({ select: { id: true, name: true, views: true, _count: { select: { leads: true } } }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const get = (rows: Row[], m: string) => rows.find((r) => r.m === m)?.n ?? 0;
  const total = (rows: Row[]) => rows.reduce((s, r) => s + r.n, 0);
  const maxLeads = Math.max(1, ...months.map((m) => get(leads, m)));
  const sources = [...bySource].sort((a, b) => b._count - a._count);
  const sourceTotal = sources.reduce((s, x) => s + x._count, 0);

  const cols = [
    { key: "leads", label: "Enquiries", rows: leads, fmt: (n: number) => String(n) },
    { key: "profiles", label: "New profiles", rows: profiles, fmt: (n: number) => String(n) },
    { key: "shared", label: "Biodatas shared", rows: shared, fmt: (n: number) => String(n) },
    { key: "matched", label: "Matched", rows: matched, fmt: (n: number) => String(n) },
    ...(features.payments ? [{ key: "money", label: "Collected", rows: collected, fmt: (n: number) => rupees(n) }] : []),
  ];

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="The last 12 months (demo data not counted)."
        actions={
          <>
            <a href="/api/export/profiles" className={buttonClass.secondary}>Export profiles (Excel)</a>
            <a href="/api/export/leads" className={buttonClass.secondary}>Export leads (Excel)</a>
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
        {cols.map((c) => (
          <div key={c.key} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-2xl font-semibold">{c.fmt(total(c.rows))}</div>
            <div className="text-sm text-zinc-500">{c.label}, 12 months</div>
          </div>
        ))}
      </div>

      <Card title="Month by month" className="mb-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-zinc-500">
              <tr>
                <th className="py-1.5 pr-3">Month</th>
                {cols.map((c) => <th key={c.key} className="py-1.5 pr-3 text-right">{c.label}</th>)}
                <th className="hidden w-1/3 py-1.5 sm:table-cell" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {months.map((m) => (
                <tr key={m}>
                  <td className="whitespace-nowrap py-1.5 pr-3">{monthLabel(m)}</td>
                  {cols.map((c) => (
                    <td key={c.key} className={cx("py-1.5 pr-3 text-right tabular-nums", get(c.rows, m) === 0 && "text-zinc-300")}>{c.fmt(get(c.rows, m))}</td>
                  ))}
                  <td className="hidden py-1.5 sm:table-cell" aria-hidden="true">
                    <div className="h-2 rounded-full bg-brand-200" style={{ width: `${(get(leads, m) / maxLeads) * 100}%` }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-zinc-400">The bar shows enquiries.</p>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Where enquiries come from">
          {sources.length === 0 ? (
            <p className="text-sm text-zinc-500">No enquiries yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {sources.map((s) => (
                <li key={s.source}>
                  <div className="flex justify-between">
                    <span>{SOURCE_LABELS[s.source]}</span>
                    <span className="tabular-nums text-zinc-600">{s._count} ({Math.round((s._count / sourceTotal) * 100)}%)</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-zinc-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${(s._count / sourceTotal) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {features.leadForms && (
          <Card title="Enquiry forms" actions={<Link href="/leads/forms" className="text-sm text-brand-700 hover:underline">All forms</Link>}>
            {byForm.length === 0 ? (
              <p className="text-sm text-zinc-500">No enquiry form links yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-zinc-500">
                  <tr><th className="py-1">Link</th><th className="py-1 text-right">Visits</th><th className="py-1 text-right">Enquiries</th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {byForm.map((f) => (
                    <tr key={f.id}>
                      <td className="py-1.5"><Link href={`/leads?form=${f.id}&status=ALL`} className="hover:text-brand-700">{f.name}</Link></td>
                      <td className="py-1.5 text-right tabular-nums">{f.views}</td>
                      <td className="py-1.5 text-right tabular-nums">{f._count.leads}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
