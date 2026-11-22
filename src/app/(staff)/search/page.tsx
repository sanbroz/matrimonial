import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { ageFrom } from "@/lib/format";
import { SOURCE_LABELS } from "@/lib/lead-labels";
import { Badge, Card, EmptyState, PageHeader, inputClass, buttonClass } from "@/components/ui";

export const metadata = { title: "Search" };

/** One search over profiles (code, name, phone, city, father's name) and leads (name, phone, city). */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser();
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const digits = q.replace(/\D/g, "");
  const byPhone = digits.length >= 5 ? digits.slice(-10) : null;

  const profileWhere: Prisma.ProfileWhereInput = {
    OR: [
      { code: { equals: q.toUpperCase() } },
      { code: { contains: q, mode: "insensitive" } },
      { fullName: { contains: q, mode: "insensitive" } },
      { fatherName: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
      ...(byPhone ? [{ phone: { contains: byPhone } }, { altPhone: { contains: byPhone } }] : []),
    ],
  };
  const leadWhere: Prisma.LeadWhereInput = {
    OR: [
      { name: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
      ...(byPhone ? [{ phone: { contains: byPhone } }, { altPhone: { contains: byPhone } }] : []),
    ],
  };
  const [profiles, leads] = q.length >= 2
    ? await Promise.all([
        prisma.profile.findMany({
          where: profileWhere,
          take: 30,
          orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
          select: { id: true, code: true, fullName: true, gender: true, dob: true, religion: true, city: true, status: true },
        }),
        prisma.lead.findMany({ where: leadWhere, take: 20, orderBy: { createdAt: "desc" }, select: { id: true, name: true, phone: true, city: true, source: true, status: true } }),
      ])
    : [[], []];

  return (
    <>
      <PageHeader title="Search" />
      <form className="mb-5 flex gap-2">
        <input name="q" defaultValue={q} autoFocus placeholder="Profile code, name, phone or city" className={inputClass + " max-w-md"} aria-label="Search" />
        <button className={buttonClass.primary}>Search</button>
      </form>
      {q.length < 2 ? (
        <EmptyState>Type at least 2 letters or digits.</EmptyState>
      ) : profiles.length + leads.length === 0 ? (
        <EmptyState>Nothing found for “{q}”.</EmptyState>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title={`Profiles (${profiles.length}${profiles.length === 30 ? "+" : ""})`}>
            {profiles.length === 0 ? (
              <p className="text-sm text-zinc-500">No profiles.</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {profiles.map((p) => (
                  <li key={p.id} className="py-2">
                    <Link href={`/profiles/${p.id}`} className="flex flex-wrap items-baseline gap-x-2 hover:text-brand-700">
                      <span className="font-mono text-xs text-brand-700">{p.code}</span>
                      <span className="font-medium">{p.fullName}</span>
                      {p.status !== "ACTIVE" && <Badge>{p.status.toLowerCase().replace("_", " ")}</Badge>}
                      <span className="w-full text-xs text-zinc-500">
                        {[p.gender === "MALE" ? "Groom" : "Bride", ageFrom(p.dob) != null ? `${ageFrom(p.dob)} yrs` : null, p.religion, p.city].filter(Boolean).join(" · ")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={`Leads (${leads.length})`}>
            {leads.length === 0 ? (
              <p className="text-sm text-zinc-500">No leads.</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {leads.map((l) => (
                  <li key={l.id} className="py-2">
                    <Link href={`/leads/${l.id}`} className="flex flex-wrap items-baseline gap-x-2 hover:text-brand-700">
                      <span className="font-medium">{l.name}</span>
                      <Badge>{l.status.toLowerCase().replace("_", " ")}</Badge>
                      <span className="w-full text-xs text-zinc-500">{[l.phone, l.city, SOURCE_LABELS[l.source]].filter(Boolean).join(" · ")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
