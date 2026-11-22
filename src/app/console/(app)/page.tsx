import { requireConsoleAdmin } from "@/lib/auth/server";
import Link from "next/link";
import { platform } from "@/lib/platform-db";
import { billingState, daysOverdue } from "@/lib/billing";
import { rupees } from "@/lib/money";
import { todayDate } from "@/lib/services/billing";
import { subdomainUrl } from "@/lib/tenant/host";
import { Badge, ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { Flash } from "@/app/(staff)/settings/flash";
import { formatDateOnly } from "@/lib/format";

export const metadata = { title: "Bureaus" };

const STATUS_TONE = { ACTIVE: "green", TRIAL: "blue", SUSPENDED: "red" } as const;

export default async function BureausPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireConsoleAdmin(); // layouts don't re-run on client navigation
  const sp = await searchParams;
  const today = todayDate();
  const tenants = await platform.tenant.findMany({ orderBy: { createdAt: "asc" } });
  const overdue = tenants.filter((t) => t.status !== "SUSPENDED" && billingState(t.nextDueDate, today) === "overdue");
  const soon = tenants.filter((t) => t.status !== "SUSPENDED" && billingState(t.nextDueDate, today) === "due_soon");
  const monthly = tenants
    .filter((t) => t.status === "ACTIVE")
    .reduce((s, t) => s + Math.round(t.fee / { MONTHLY: 1, QUARTERLY: 3, HALF_YEARLY: 6, YEARLY: 12 }[t.billingCycle]), 0);

  const stats = [
    { label: "Bureaus", value: tenants.length },
    { label: "Active", value: tenants.filter((t) => t.status === "ACTIVE").length },
    { label: "On trial", value: tenants.filter((t) => t.status === "TRIAL").length },
    { label: "Payment overdue", value: overdue.length, alert: overdue.length > 0 },
    { label: "Due in 7 days", value: soon.length },
    { label: "Monthly fees (active)", value: rupees(monthly) },
  ];

  return (
    <>
      <PageHeader title="Bureaus" actions={<ButtonLink href="/console/tenants/new" variant="primary">Add bureau</ButtonLink>} />
      <Flash {...sp} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className={s.alert ? "text-2xl font-semibold text-red-600" : "text-2xl font-semibold"}>{s.value}</div>
            <div className="text-sm text-zinc-500">{s.label}</div>
          </div>
        ))}
      </div>

      {tenants.length === 0 ? (
        <EmptyState>No bureaus yet. Add the first one.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
              <tr>
                <th className="px-3 py-2">Bureau</th>
                <th className="hidden px-3 py-2 md:table-cell">Address</th>
                <th className="px-3 py-2">Status</th>
                <th className="hidden px-3 py-2 sm:table-cell">Fee</th>
                <th className="px-3 py-2">Next due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {tenants.map((t) => {
                const state = billingState(t.nextDueDate, today);
                const d = t.nextDueDate ? daysOverdue(t.nextDueDate, today) : 0;
                return (
                  <tr key={t.id} className="hover:bg-zinc-50">
                    <td className="px-3 py-2">
                      <Link href={`/console/tenants/${t.id}`} className="font-medium text-zinc-900 hover:text-brand-700">{t.name}</Link>
                      <span className="block text-xs text-zinc-500">{t.contactName ?? ""}{t.contactPhone ? ` · ${t.contactPhone}` : ""}</span>
                    </td>
                    <td className="hidden px-3 py-2 md:table-cell">
                      <a href={subdomainUrl(t.slug)} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">
                        {subdomainUrl(t.slug).replace(/^https?:\/\//, "")}
                      </a>
                    </td>
                    <td className="px-3 py-2"><Badge tone={STATUS_TONE[t.status]}>{t.status.toLowerCase()}</Badge></td>
                    <td className="hidden px-3 py-2 sm:table-cell">{t.fee ? `${rupees(t.fee)} / ${t.billingCycle.toLowerCase().replace("_", "-")}` : "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {t.nextDueDate ? (
                        <span className={state === "overdue" ? "text-red-600" : state === "due_soon" ? "text-amber-700" : "text-zinc-600"}>
                          {formatDateOnly(t.nextDueDate)}
                          {state === "overdue" && ` (${d} day${d === 1 ? "" : "s"} overdue)`}
                          {state === "due_soon" && (d === 0 ? " (today)" : ` (in ${-d} day${d === -1 ? "" : "s"})`)}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
