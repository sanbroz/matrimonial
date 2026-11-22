import Link from "next/link";
import { requireUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { formatDateOnly, toDateInput } from "@/lib/format";
import { Badge, Card, EmptyState, Field, PageHeader, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { saveStory } from "./actions";

export const metadata = { title: "Matched couples" };

/** Every match the bureau made: the success stories (wedding date and a short note can be added). */
export default async function MatchedPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requireUser();
  const { ok } = await searchParams;
  const select = { id: true, code: true, fullName: true, city: true, country: true } as const;
  const couples = await prisma.proposal.findMany({
    where: { status: "MATCHED" },
    orderBy: [{ matchedAt: "desc" }, { updatedAt: "desc" }],
    include: { fromProfile: { select }, toProfile: { select } },
    take: 300,
  });
  const married = couples.filter((c) => c.marriedOn).length;

  return (
    <>
      <PageHeader title="Matched couples" subtitle={`${couples.length} match${couples.length === 1 ? "" : "es"} made${married ? `, ${married} married` : ""}. Your success stories.`} />
      {ok && <p className="mb-3 text-sm text-emerald-700">{ok}</p>}
      {couples.length === 0 ? (
        <EmptyState>No matches yet. When a proposal is set to &quot;Matched&quot;, the couple appears here.</EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {couples.map((c) => (
            <Card key={c.id}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <Link href={`/profiles/${c.fromProfile.id}`} className="hover:text-brand-700">
                  <span className="font-mono text-xs text-brand-700">{c.fromProfile.code}</span> <span className="font-medium">{c.fromProfile.fullName}</span>
                </Link>
                <span className="text-zinc-400">&amp;</span>
                <Link href={`/profiles/${c.toProfile.id}`} className="hover:text-brand-700">
                  <span className="font-mono text-xs text-brand-700">{c.toProfile.code}</span> <span className="font-medium">{c.toProfile.fullName}</span>
                </Link>
                {c.marriedOn ? <Badge tone="brand">married {formatDateOnly(c.marriedOn)}</Badge> : <Badge tone="green">matched</Badge>}
              </div>
              <p className="mt-1 text-xs text-zinc-500">Matched {c.matchedAt ? formatDateOnly(c.matchedAt) : "—"}</p>
              {c.storyNote && <p className="mt-2 whitespace-pre-wrap rounded bg-zinc-50 p-2 text-sm italic text-zinc-700">{c.storyNote}</p>}
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-xs font-medium text-brand-700">{c.marriedOn || c.storyNote ? "Edit" : "Add wedding date / note"}</summary>
                <form key={`${c.id}:${c.updatedAt.toISOString()}`} action={saveStory} className="mt-2 grid gap-2 sm:grid-cols-[10rem_1fr]">
                  <input type="hidden" name="id" value={c.id} />
                  <Field label="Wedding date"><input type="date" name="marriedOn" defaultValue={toDateInput(c.marriedOn)} className={inputClass} /></Field>
                  <Field label="Note"><input name="storyNote" defaultValue={c.storyNote ?? ""} maxLength={500} placeholder="e.g. Wedding in Ludhiana, families very happy" className={inputClass} /></Field>
                  <div><SubmitButton variant="secondary">Save</SubmitButton></div>
                </form>
              </details>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
