import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { suggestMatches } from "@/lib/services/matching";
import { fileUrl } from "@/lib/storage";
import { ageFrom, formatHeight } from "@/lib/format";
import { MARITAL_LABELS } from "@/lib/profile-fields";
import { Alert, Badge, ButtonLink, Card, EmptyState, PageHeader, cx } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { shareMatch } from "./actions";
import { SelectionBar } from "@/components/small-client";

export const metadata = { title: "Suggested matches" };

const SHOW = 60;
const GOTRA_RULE = { all: "all recorded gotras (self, mother, dadi)", self: "own gotra only", off: "off" } as const;

export default async function MatchesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ all?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { all } = await searchParams;
  const client = await prisma.profile.findUnique({
    where: { id },
    select: { id: true, code: true, fullName: true, gender: true, status: true, preference: { select: { id: true } } },
  });
  if (!client) notFound();
  const result = await suggestMatches(id);
  if (!result) notFound();

  const shown = all ? result.suggested : result.suggested.slice(0, SHOW);
  const ids = [...shown.map((s) => s.candidateId), ...result.excluded.map((e) => e.candidateId)];
  const details = await prisma.profile.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, code: true, fullName: true, dob: true, heightCm: true, maritalStatus: true, religion: true, caste: true,
      gotraSelf: true, education: true, profession: true, city: true, country: true, visaStatus: true, status: true,
      photos: { where: { isPrimary: true }, take: 1, select: { path: true } },
    },
  });
  const byId = new Map(details.map((d) => [d.id, d]));

  // Most common exclusion reasons, for a quick overview
  const reasonCounts = new Map<string, number>();
  for (const e of result.excluded) {
    for (const r of e.excluded) {
      const key = reasonCategory(r);
      reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
    }
  }
  const topReasons = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <>
      <PageHeader
        title={<>Suggested matches for <span className="font-mono text-brand-700">{client.code}</span> {client.fullName}</>}
        subtitle={`${result.suggested.length} suggested · ${result.excluded.length} ruled out · ${result.alreadySharedCount} already shared (hidden)`}
        actions={<ButtonLink href={`/profiles/${client.id}`}>Back to profile</ButtonLink>}
      />

      <div className="mb-4 space-y-2">
        {!client.preference && (
          <Alert tone="amber">
            This client has no partner preferences yet, so only the gotra rule and the other families&apos; preferences are applied.{" "}
            <Link href={`/profiles/${client.id}/edit`} className="underline">Add preferences</Link>
          </Alert>
        )}
        {client.status !== "ACTIVE" && <Alert tone="amber">This client is not active. Suggestions are shown anyway.</Alert>}
        <p className="text-xs text-zinc-500">
          Rules: gotra check uses {GOTRA_RULE[result.options.gotraRule]}; preferences checked {result.options.twoWay ? "both ways" : "one way (client's only)"};
          {result.options.includeOnHold ? " including" : " excluding"} on-hold profiles.
          {user.role === "OWNER" && <> <Link href="/settings/matching" className="text-brand-700 underline">Change rules</Link></>}
        </p>
      </div>

      {shown.length === 0 ? (
        <EmptyState>No suitable profiles right now. Check the ruled-out list below, or loosen the client&apos;s preferences.</EmptyState>
      ) : (
        <>
        {/* Tick several and share them together (one PDF / link) */}
        <form id="share-select" action="/share" className="mb-2 text-xs text-zinc-500">
          <input type="hidden" name="for" value={client.id} />
          Tick profiles to share several together (one PDF, images or a link).
        </form>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {shown.map((s) => {
            const d = byId.get(s.candidateId)!;
            const age = ageFrom(d.dob);
            return (
              <Card key={s.candidateId} className="flex flex-col">
                <div className="flex gap-3">
                  <input
                    type="checkbox"
                    name="id"
                    value={d.id}
                    form="share-select"
                    aria-label={`Select ${d.code} to share`}
                    className="mt-1 size-4 shrink-0 accent-brand-600"
                  />
                  {d.photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fileUrl(d.photos[0].path)} alt="" className="size-20 shrink-0 rounded-md object-cover" />
                  ) : (
                    <div className="flex size-20 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-xs text-zinc-400">No photo</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/profiles/${d.id}`} className="min-w-0 hover:text-brand-700">
                        <span className="font-mono text-xs text-brand-700">{d.code}</span>
                        <span className="block truncate font-medium">{d.fullName}</span>
                      </Link>
                      <ScoreBadge score={s.score} />
                    </div>
                    <p className="mt-1 text-xs text-zinc-600">
                      {[
                        age != null ? `${age} yrs` : null,
                        formatHeight(d.heightCm).split(" ")[0] || null,
                        d.maritalStatus !== "NEVER_MARRIED" ? MARITAL_LABELS[d.maritalStatus] : null,
                        [d.religion, d.caste].filter(Boolean).join(" "),
                        d.gotraSelf && `gotra ${d.gotraSelf}`,
                      ].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-xs text-zinc-600">
                      {[d.education, d.profession, [d.city, d.country !== "India" ? d.country : null].filter(Boolean).join(", "), d.visaStatus]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {s.good.map((g) => <Badge key={g} tone="green">{g}</Badge>)}
                  {s.warnings.map((w) => <Badge key={w} tone="amber">{w}</Badge>)}
                  {d.status === "ON_HOLD" && <Badge>On hold</Badge>}
                </div>
                <form action={shareMatch} className="mt-3 flex items-center justify-end gap-2 border-t border-zinc-100 pt-3">
                  <input type="hidden" name="clientId" value={client.id} />
                  <input type="hidden" name="candidateId" value={d.id} />
                  <ButtonLink href={`/profiles/${d.id}/biodata?for=${client.id}`} className="mr-auto">Biodata</ButtonLink>
                  <SubmitButton variant="secondary" pendingText="Saving…">Mark as shared</SubmitButton>
                </form>
              </Card>
            );
          })}
        </div>
        <SelectionBar formId="share-select" label={`Share with ${client.code}`} />
        </>
      )}
      {!all && result.suggested.length > SHOW && (
        <div className="mt-4 text-center">
          <ButtonLink href={`?all=1`}>Show all {result.suggested.length} suggestions</ButtonLink>
        </div>
      )}

      {result.excluded.length > 0 && (
        <details className="mt-6 rounded-lg border border-zinc-200 bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
            Ruled out: {result.excluded.length}{" "}
            <span className="font-normal text-zinc-500">
              ({topReasons.map(([r, n]) => `${r}: ${n}`).join(" · ")})
            </span>
          </summary>
          <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
            {result.excluded.map((e) => {
              const d = byId.get(e.candidateId)!;
              return (
                <li key={e.candidateId} className="flex flex-wrap gap-x-3 px-4 py-2 text-sm">
                  <Link href={`/profiles/${d.id}`} className="w-56 shrink-0 truncate hover:text-brand-700">
                    <span className="font-mono text-xs text-brand-700">{d.code}</span> {d.fullName}
                  </Link>
                  <span className="text-zinc-600">{e.excluded.join("; ")}</span>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </>
  );
}

/** "Their preference: age 31 is outside 22–29" → "age (their preference)" */
function reasonCategory(r: string): string {
  if (r.startsWith("Same gotra")) return "same gotra";
  const m = r.match(/^(Your|Their) preference: (.*)$/);
  if (!m) return r;
  const who = m[1] === "Your" ? "client's preference" : "their preference";
  const t = m[2];
  const what = /^age/.test(t) ? "age"
    : /^height/.test(t) ? "height"
    : /^religion/.test(t) ? "religion"
    : /excluded/.test(t) ? "excluded caste"
    : /^caste/.test(t) ? "caste"
    : /^lives in/.test(t) ? "country"
    : /not acceptable/.test(t) ? "marital status"
    : t;
  return `${what} (${who})`;
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <span
      title="Match score (0–100)"
      className={cx(
        "shrink-0 rounded-full px-2 py-0.5 text-sm font-semibold",
        score >= 70 ? "bg-emerald-50 text-emerald-700" : score >= 50 ? "bg-sky-50 text-sky-700" : "bg-zinc-100 text-zinc-600",
      )}
    >
      {score}
    </span>
  );
}
