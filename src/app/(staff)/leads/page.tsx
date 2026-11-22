import Link from "next/link";
import type { LeadStatus, Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { Badge, ButtonLink, EmptyState, PageHeader, buttonClass, cx, inputClass } from "@/components/ui";
import { SOURCE_LABELS } from "@/lib/lead-labels";

export const metadata = { title: "Leads" };

const STATUS_TABS: { value: LeadStatus | "OPEN" | "ALL"; label: string }[] = [
  { value: "OPEN", label: "Open" },
  { value: "NEW", label: "New" },
  { value: "FOLLOW_UP", label: "Follow up" },
  { value: "CONVERTED", label: "Converted" },
  { value: "LOST", label: "Lost" },
  { value: "ALL", label: "All" },
];
const TONE = { NEW: "blue", FOLLOW_UP: "amber", CONVERTED: "green", LOST: "zinc" } as const;

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const status = (STATUS_TABS.find((t) => t.value === sp.status)?.value ?? "OPEN") as (typeof STATUS_TABS)[number]["value"];
  const where: Prisma.LeadWhereInput = {};
  if (status === "OPEN") where.status = { in: ["NEW", "FOLLOW_UP"] };
  else if (status !== "ALL") where.status = status;
  const q = sp.q?.trim();
  if (q) {
    const digits = q.replace(/\D/g, "");
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
      ...(digits.length >= 5 ? [{ phone: { contains: digits.slice(-10) } }] : []),
    ];
  }

  const leads = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      followUps: { where: { done: false }, orderBy: { dueAt: "asc" }, take: 1 },
      profile: { select: { code: true } },
    },
  });

  return (
    <>
      <PageHeader title="Leads" subtitle="Enquiries that have not registered yet" actions={<ButtonLink href="/leads/new" variant="primary">Add lead</ButtonLink>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {STATUS_TABS.map((t) => (
            <Link
              key={t.value}
              href={`/leads?status=${t.value}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={cx("rounded-md px-3 py-1.5 text-sm", status === t.value ? "bg-brand-600 text-white" : "bg-white text-zinc-700 hover:bg-zinc-100")}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <form className="ml-auto flex gap-2">
          <input type="hidden" name="status" value={status} />
          <input name="q" defaultValue={q} placeholder="Name, phone, city" className={inputClass + " w-48!"} />
          <button className={buttonClass.secondary}>Search</button>
        </form>
      </div>

      {leads.length === 0 ? (
        <EmptyState>No leads here.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Phone</th>
                <th className="hidden px-3 py-2 sm:table-cell">Source</th>
                <th className="px-3 py-2">Next follow-up</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {leads.map((l) => (
                <tr key={l.id} className="hover:bg-zinc-50">
                  <td className="px-3 py-2">
                    <Link href={`/leads/${l.id}`} className="font-medium text-zinc-900 hover:text-brand-700">{l.name}</Link>
                    <span className="block text-xs text-zinc-500">
                      {[l.forWhom && `for ${l.forWhom.toLowerCase()}`, l.city].filter(Boolean).join(" · ")}
                    </span>
                  </td>
                  <td className="px-3 py-2"><a href={`tel:${l.phone}`} className="text-zinc-700">{l.phone}</a></td>
                  <td className="hidden px-3 py-2 text-zinc-600 sm:table-cell">{SOURCE_LABELS[l.source]}</td>
                  <td className="px-3 py-2 text-xs">
                    {l.followUps[0] ? (
                      <span className={l.followUps[0].dueAt < new Date() ? "text-red-600" : "text-zinc-600"}>{formatDateTime(l.followUps[0].dueAt)}</span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={TONE[l.status]}>{l.status.replace("_", " ").toLowerCase()}</Badge>
                    {l.profile && <span className="ml-1 font-mono text-xs text-brand-700">{l.profile.code}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
