import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { PROPOSAL_LABELS, PROPOSAL_TONE, needsAttention } from "@/lib/proposal-labels";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ProposalUpdateForm } from "@/components/proposal-update-form";
import { removeProposal } from "./matches/actions";

/** Biodata shared with this family, and this profile's biodata shared with others — with timeline. */
export async function ProposalsPanel({ profileId }: { profileId: string }) {
  const select = { id: true, code: true, fullName: true } as const;
  const proposals = await prisma.proposal.findMany({
    where: { OR: [{ fromProfileId: profileId }, { toProfileId: profileId }] },
    orderBy: { updatedAt: "desc" },
    include: {
      fromProfile: { select },
      toProfile: { select },
      createdBy: { select: { name: true } },
      events: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
    },
  });

  return (
    <Card
      title={`Shared biodata (${proposals.length})`}
      actions={<ButtonLink href={`/profiles/${profileId}/matches`} variant="primary">Suggested matches</ButtonLink>}
    >
      {proposals.length === 0 ? (
        <p className="text-sm text-zinc-400">Nothing shared yet. Open suggested matches to find profiles for this family.</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {proposals.map((p) => {
            const outgoing = p.fromProfileId === profileId; // other profile shown TO this family
            const other = outgoing ? p.toProfile : p.fromProfile;
            const attention = needsAttention(p);
            return (
              <li key={p.id} className="py-2.5">
                <details className="group">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-zinc-400 transition group-open:rotate-90">›</span>
                    <span className="min-w-0 flex-1">
                      <Link href={`/profiles/${other.id}`} className="text-sm hover:text-brand-700">
                        <span className="font-mono text-xs text-brand-700">{other.code}</span> {other.fullName}
                      </Link>
                      <span className="block text-xs text-zinc-500">
                        {outgoing ? "Their biodata was shown to this family" : "This biodata was shown to their family"} · last update{" "}
                        {formatDateTime(p.updatedAt)}
                        {p.status === "MEETING_SCHEDULED" && p.meetingAt && <> · meeting {formatDateTime(p.meetingAt)}</>}
                      </span>
                    </span>
                    {attention && <Badge tone="red">Needs follow-up</Badge>}
                    <Badge tone={PROPOSAL_TONE[p.status]}>{PROPOSAL_LABELS[p.status]}</Badge>
                  </summary>
                  <div className="mt-3 space-y-3 pl-5">
                    <ProposalUpdateForm id={p.id} status={p.status} />
                    <ol className="space-y-1.5 border-l-2 border-zinc-100 pl-3 text-sm">
                      {p.events.map((e) => (
                        <li key={e.id}>
                          <span className="font-medium">{PROPOSAL_LABELS[e.status]}</span>
                          {e.note && <span className="text-zinc-700"> · {e.note}</span>}
                          <span className="block text-xs text-zinc-400">{formatDateTime(e.createdAt)} · {e.user.name}</span>
                        </li>
                      ))}
                      {/* Proposals from before the timeline existed */}
                      {!p.events.some((e) => e.status === "SHARED") && (
                        <li>
                          <span className="font-medium">Shared</span>
                          <span className="block text-xs text-zinc-400">{formatDateTime(p.createdAt)} · {p.createdBy.name}</span>
                        </li>
                      )}
                    </ol>
                    <form action={removeProposal}>
                      <input type="hidden" name="id" value={p.id} />
                      <SubmitButton variant="ghost" pendingText="…" confirm="Remove this record and its timeline? The profile will appear in suggestions again.">
                        Remove record
                      </SubmitButton>
                    </form>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
