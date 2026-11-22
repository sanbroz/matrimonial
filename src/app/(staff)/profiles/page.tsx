import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { loadOptions } from "@/lib/services/profiles";
import { fileUrl } from "@/lib/storage";
import { ageFrom, formatHeight, nowIST } from "@/lib/format";
import { MARITAL_LABELS } from "@/lib/profile-fields";
import { Alert, Badge, ButtonLink, EmptyState, PageHeader, buttonClass, cx, inputClass } from "@/components/ui";
import { deleteSearch, saveSearch } from "./saved-search-actions";
import { SelectionBar } from "@/components/small-client";
import { countMatches } from "@/lib/services/matching";

export const metadata = { title: "Profiles" };

const PAGE_SIZE = 50;
type SP = Record<string, string | undefined>;

export default async function ProfilesPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.ProfileWhereInput = { AND: [] };
  const and = where.AND as Prisma.ProfileWhereInput[];
  const q = sp.q?.trim();
  if (q) {
    const digits = q.replace(/\D/g, "");
    and.push({
      OR: [
        { code: { equals: q, mode: "insensitive" } },
        { fullName: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { nativePlace: { contains: q, mode: "insensitive" } },
        { fatherName: { contains: q, mode: "insensitive" } },
        ...(digits.length >= 5
          ? [{ phone: { contains: digits.slice(-10) } }, { altPhone: { contains: digits.slice(-10) } }]
          : []),
      ],
    });
  }
  if (sp.gender === "MALE" || sp.gender === "FEMALE") and.push({ gender: sp.gender });
  if (sp.status && ["ACTIVE", "ON_HOLD", "MATCHED", "CLOSED"].includes(sp.status)) and.push({ status: sp.status as never });
  else if (!sp.status) and.push({ status: { in: ["ACTIVE", "ON_HOLD"] } });
  if (sp.marital && sp.marital in MARITAL_LABELS) and.push({ maritalStatus: sp.marital as never });
  for (const k of ["religion", "caste", "country", "education"] as const) {
    if (sp[k]) and.push({ [k]: { equals: sp[k], mode: "insensitive" } });
  }
  // Age → DOB range (date-only, UTC)
  const now = nowIST(); // India date, so age filters are right just after midnight IST
  const yearsAgo = (y: number) => new Date(Date.UTC(now.getUTCFullYear() - y, now.getUTCMonth(), now.getUTCDate()));
  if (Number(sp.ageMin)) and.push({ dob: { lte: yearsAgo(Number(sp.ageMin)) } });
  if (Number(sp.ageMax)) and.push({ dob: { gt: yearsAgo(Number(sp.ageMax) + 1) } });
  if (sp.flag === "urgent") and.push({ urgent: true });
  if (sp.flag === "vip") and.push({ vip: true });
  if (sp.flag === "nri") and.push({ country: { not: "India" }, NOT: { country: null } });

  const [total, profiles, options, saved] = await Promise.all([
    prisma.profile.count({ where }),
    prisma.profile.findMany({
      where,
      orderBy: [{ urgent: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { photos: { where: { isPrimary: true }, take: 1 } },
    }),
    loadOptions(),
    prisma.savedSearch.findMany({ orderBy: { name: "asc" }, include: { user: { select: { name: true } } } }),
  ]);
  // Suggested-match counts for the profiles on this page (same rules as "Suggested matches")
  const matchCounts = await countMatches(profiles.map((p) => p.id));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filterQuery = new URLSearchParams(
    Object.entries(sp).filter(([k, v]) => v && !["page", "deleted"].includes(k)) as [string, string][],
  ).toString();
  const activeFilters = Object.entries(sp).filter(([k, v]) => v && !["page", "deleted", "q"].includes(k)).length;
  const qs = (patch: SP) => {
    const u = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `?${u}`;
  };

  return (
    <>
      <PageHeader
        title="Profiles"
        subtitle={`${total} found`}
        actions={
          <>
            <ButtonLink href="/import">Import from Excel</ButtonLink>
            <ButtonLink href="/shares">Share links</ButtonLink>
            <ButtonLink href="/profiles/new" variant="primary">Add profile</ButtonLink>
          </>
        }
      />
      {sp.deleted && <div className="mb-4"><Alert tone="green">Profile {sp.deleted} was deleted permanently.</Alert></div>}

      {(saved.length > 0 || filterQuery) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {saved.length > 0 && <span className="text-xs text-zinc-500">Saved searches:</span>}
          {saved.map((s) => (
            <span
              key={s.id}
              className={cx(
                "inline-flex items-center rounded-full border text-sm",
                s.query === filterQuery ? "border-brand-200 bg-brand-50 text-brand-700" : "border-zinc-200 bg-white",
              )}
            >
              <Link href={`/profiles?${s.query}`} className="py-1 pl-3 pr-1" title={`Saved by ${s.user.name}`}>{s.name}</Link>
              <form action={deleteSearch}>
                <input type="hidden" name="id" value={s.id} />
                <button className="px-2 py-1 text-zinc-400 hover:text-red-600" title="Delete saved search" aria-label={`Delete ${s.name}`}>×</button>
              </form>
            </span>
          ))}
          {filterQuery && !saved.some((s) => s.query === filterQuery) && (
            <form action={saveSearch} className="ml-auto flex gap-1">
              <input type="hidden" name="query" value={filterQuery} />
              <input name="name" required maxLength={60} placeholder="Name this search" className={inputClass + " w-44! py-1.5!"} />
              <button className={buttonClass.secondary}>Save search</button>
            </form>
          )}
        </div>
      )}

      {/* key: "Clear" and saved-search links stay on this page; remount so the selects show the new filters */}
      <form key={filterQuery} className="mb-5 rounded-lg border border-zinc-200 bg-white p-3">
        <div className="flex gap-2">
          <input name="q" defaultValue={sp.q} placeholder="Code, name, phone, city…" aria-label="Search" className={inputClass} />
          <button className={buttonClass.primary}>Search</button>
        </div>
        {/* Phones: the filters fold away behind a "Filters" toggle (pure CSS); always shown on wider screens */}
        <input type="checkbox" id="show-filters" className="peer sr-only" defaultChecked={activeFilters > 0} />
        <label htmlFor="show-filters" className="mt-2 inline-block cursor-pointer text-sm font-medium text-brand-700 sm:hidden">
          Filters{activeFilters > 0 ? ` (${activeFilters})` : ""}
        </label>
        <div className="mt-2 hidden grid-cols-2 gap-2 peer-checked:grid sm:grid sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        <select name="gender" defaultValue={sp.gender ?? ""} aria-label="Bride or groom" className={inputClass}>
          <option value="">Bride & groom</option>
          <option value="FEMALE">Brides</option>
          <option value="MALE">Grooms</option>
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className={inputClass}>
          <option value="">Active + on hold</option>
          <option value="ACTIVE">Active</option>
          <option value="ON_HOLD">On hold</option>
          <option value="MATCHED">Matched</option>
          <option value="CLOSED">Closed</option>
          <option value="ALL">All statuses</option>
        </select>
        <OptSelect name="religion" label="Any religion" values={options.religion} current={sp.religion} />
        <OptSelect name="caste" label="Any caste" values={options.caste} current={sp.caste} />
        <select name="marital" defaultValue={sp.marital ?? ""} className={inputClass}>
          <option value="">Any marital status</option>
          {Object.entries(MARITAL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <OptSelect name="country" label="Any country" values={options.country} current={sp.country} />
        <OptSelect name="education" label="Any education" values={options.education} current={sp.education} />
        <div className="flex gap-1">
          <input name="ageMin" type="number" min={18} max={80} defaultValue={sp.ageMin} placeholder="Age" aria-label="Age from" className={inputClass} />
          <input name="ageMax" type="number" min={18} max={80} defaultValue={sp.ageMax} placeholder="to" aria-label="Age to" className={inputClass} />
        </div>
        <select name="flag" defaultValue={sp.flag ?? ""} aria-label="Flag" className={inputClass}>
          <option value="">Any flag</option>
          <option value="urgent">Urgent</option>
          <option value="vip">VIP</option>
          <option value="nri">NRI (outside India)</option>
        </select>
        <div className="flex gap-2">
          <button className={buttonClass.secondary}>Apply</button>
          <Link href="/profiles" className={buttonClass.ghost}>Clear</Link>
        </div>
        </div>
      </form>

      {profiles.length === 0 ? (
        <EmptyState>No profiles match. <Link href="/profiles/new" className="text-brand-700 underline">Add one</Link> or <Link href="/import" className="text-brand-700 underline">import from Excel</Link>.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          {/* Tick several and share them together (one PDF / images / link) */}
          <form id="share-select" action="/share" />
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
              <tr>
                <th className="w-8 py-2 pl-3"><span className="sr-only">Select</span></th>
                <th className="px-3 py-2">Profile</th>
                <th className="px-3 py-2">Age / height</th>
                <th className="px-3 py-2">Community</th>
                <th className="px-3 py-2 text-center">Matches</th>
                <th className="hidden px-3 py-2 md:table-cell">Education / work</th>
                <th className="hidden px-3 py-2 md:table-cell">Location</th>
                <th className="hidden px-3 py-2 sm:table-cell">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {profiles.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50">
                  <td className="py-2 pl-3">
                    <input type="checkbox" name="id" value={p.id} form="share-select" aria-label={`Select ${p.code} to share`} className="size-4 accent-brand-600" />
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/profiles/${p.id}`} className="flex items-center gap-3">
                      {p.photos[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={fileUrl(p.photos[0].path)} alt="" className="size-10 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs text-zinc-500">
                          {p.gender === "MALE" ? "G" : "B"}
                        </span>
                      )}
                      <span>
                        <span className="font-mono text-xs text-brand-700">{p.code}</span>
                        <span className="block font-medium text-zinc-900">{p.fullName}</span>
                        {/* Phones: status under the name (the Status column is hidden) */}
                        <span className="mt-0.5 flex flex-wrap gap-1 sm:hidden"><StatusBadges p={p} /></span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-zinc-700">
                    {ageFrom(p.dob) ?? "?"} yrs
                    <span className="block text-xs text-zinc-500">{formatHeight(p.heightCm).split(" ")[0]}</span>
                  </td>
                  <td className="px-3 py-2 text-zinc-700">
                    {p.religion}
                    <span className="block text-xs text-zinc-500">{[p.caste, p.gotraSelf].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {matchCounts.has(p.id) ? (
                      <Link
                        href={`/profiles/${p.id}/matches`}
                        title={`${matchCounts.get(p.id)} suggested matches (not yet shared)`}
                        className={cx(
                          "inline-flex min-w-9 justify-center rounded-full px-2 py-0.5 text-xs font-semibold",
                          matchCounts.get(p.id) ? "bg-brand-50 text-brand-700 hover:bg-brand-100" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200",
                        )}
                      >
                        {matchCounts.get(p.id)}
                      </Link>
                    ) : (
                      <span className="text-xs text-zinc-400" title="Only active profiles get suggestions">—</span>
                    )}
                  </td>
                  <td className="hidden px-3 py-2 text-zinc-700 md:table-cell">
                    {p.education}
                    <span className="block text-xs text-zinc-500">{p.profession}</span>
                  </td>
                  <td className="hidden px-3 py-2 text-zinc-700 md:table-cell">
                    {p.city}
                    <span className="block text-xs text-zinc-500">{[p.country !== "India" ? p.country : null, p.visaStatus].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td className="hidden px-3 py-2 sm:table-cell">
                    <span className="flex flex-wrap gap-1"><StatusBadges p={p} /></span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <SelectionBar formId="share-select" label="Share selected" />

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          {page > 1 && <Link href={qs({ page: String(page - 1) })} className={buttonClass.secondary}>Previous</Link>}
          <span className="text-zinc-500">Page {page} of {pages}</span>
          {page < pages && <Link href={qs({ page: String(page + 1) })} className={buttonClass.secondary}>Next</Link>}
        </div>
      )}
    </>
  );
}

function StatusBadges({ p }: { p: { status: string; urgent: boolean; maritalStatus: keyof typeof MARITAL_LABELS } }) {
  return (
    <>
      <Badge tone={p.status === "ACTIVE" ? "green" : p.status === "MATCHED" ? "brand" : p.status === "ON_HOLD" ? "amber" : "zinc"}>
        {p.status.replace("_", " ").toLowerCase()}
      </Badge>
      {p.urgent && <Badge tone="red">urgent</Badge>}
      {p.maritalStatus !== "NEVER_MARRIED" && <Badge tone="blue">{MARITAL_LABELS[p.maritalStatus].toLowerCase()}</Badge>}
    </>
  );
}

function OptSelect({ name, label, values = [], current }: { name: string; label: string; values?: string[]; current?: string }) {
  return (
    <select name={name} defaultValue={current ?? ""} className={inputClass}>
      <option value="">{label}</option>
      {current && !values.includes(current) && <option value={current}>{current}</option>}
      {values.map((v) => <option key={v} value={v}>{v}</option>)}
    </select>
  );
}
