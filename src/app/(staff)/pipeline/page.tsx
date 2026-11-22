import Link from "next/link";
import type { ProposalStatus } from "@prisma/client";
import { requireFeature } from "@/lib/services/workflow";
import { requireUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { MEETING_STAGES, PROPOSAL_LABELS, needsAttention } from "@/lib/proposal-labels";
import { workflowSettings } from "@/lib/services/workflow";
import { Badge, EmptyState, PageHeader, cx } from "@/components/ui";
import { ProposalUpdateForm } from "@/components/proposal-update-form";

export const metadata = { title: "Pipeline" };

const COLUMNS: ProposalStatus[] = ["SHARED", "INTERESTED", "MEETING_SCHEDULED", "MET", "MATCHED"];
const MATCHED_DAYS = 60;
const COLUMN_MAX = 60;

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ attention?: string }> }) {
  await requireUser();
  await requireFeature("pipeline");
  const { attention } = await searchParams;
  const { trackMeetings } = await workflowSettings();
  const now = new Date();
  const select = { id: true, code: true, fullName: true, gender: true } as const;
  const all = await prisma.proposal.findMany({
    where: {
      OR: [
        { status: { in: ["SHARED", "INTERESTED", "MEETING_SCHEDULED", "MET"] } },
        { status: "MATCHED", matchedAt: { gte: new Date(now.getTime() - MATCHED_DAYS * 86400000) } },
      ],
    },
    orderBy: { updatedAt: "asc" },
    include: { fromProfile: { select }, toProfile: { select } },
  });
  const flagged = all.filter((p) => needsAttention(p, now));
  const shown = attention ? flagged : all;
  const days = (d: Date) => Math.floor((now.getTime() - d.getTime()) / 86400000);
  // Without meeting tracking the meeting columns disappear (unless something is still in them)
  const columns = COLUMNS.filter((c) => trackMeetings || !MEETING_STAGES.includes(c) || all.some((p) => p.status === c));
  const gridCols = { 3: "xl:grid-cols-3", 4: "xl:grid-cols-4", 5: "xl:grid-cols-5" }[columns.length] ?? "xl:grid-cols-5";

  return (
    <>
      <PageHeader
        title="Pipeline"
        subtitle={<>Every biodata shared with a family, and what they said. <Link href="/matched" className="text-brand-700 hover:underline">Matched couples →</Link></>}
        actions={
          <div className="inline-flex overflow-hidden rounded-md border border-zinc-300 text-sm">
            <Link href="/pipeline" className={cx("px-3 py-2", !attention ? "bg-brand-600 text-white" : "bg-white")}>All ({all.length})</Link>
            <Link href="/pipeline?attention=1" className={cx("px-3 py-2", attention ? "bg-brand-600 text-white" : "bg-white")}>
              Needs follow-up ({flagged.length})
            </Link>
          </div>
        }
      />
      {shown.length === 0 ? (
        <EmptyState>{attention ? "Nothing waiting. Every open proposal has been updated recently." : "Nothing shared yet. Use Suggested matches on a profile to start."}</EmptyState>
      ) : (
        <div className={cx("grid grid-cols-1 gap-4 md:grid-cols-2", gridCols)}>
          {columns.map((col) => {
            const all = shown.filter((p) => p.status === col);
            // Long columns: the ones waiting longest first, the rest summarised
            const items = all.slice(0, COLUMN_MAX);
            return (
              <section key={col} className="min-w-0 rounded-lg bg-zinc-100 p-2">
                <h2 className="mb-2 flex items-center justify-between px-1 text-sm font-semibold">
                  {PROPOSAL_LABELS[col]} <span className="text-xs font-normal text-zinc-500">{all.length}</span>
                </h2>
                <div className="space-y-2">
                  {items.length === 0 && <p className="px-1 py-2 text-xs text-zinc-400">None</p>}
                  {all.length > items.length && (
                    <p className="px-1 py-1 text-xs text-zinc-500">
                      Showing the {COLUMN_MAX} waiting longest; {all.length - items.length} more. Update or close these to see the rest.
                    </p>
                  )}
                  {items.map((p) => {
                    const flag = needsAttention(p, now);
                    return (
                      <article key={p.id} className={cx("rounded-md border bg-white p-2.5 text-sm shadow-sm", flag ? "border-red-200" : "border-zinc-200")}>
                        <Link href={`/profiles/${p.fromProfile.id}`} className="block hover:text-brand-700">
                          <span className="font-mono text-xs text-brand-700">{p.fromProfile.code}</span> {p.fromProfile.fullName}
                        </Link>
                        <div className="text-xs text-zinc-500">received biodata of</div>
                        <Link href={`/profiles/${p.toProfile.id}`} className="block hover:text-brand-700">
                          <span className="font-mono text-xs text-brand-700">{p.toProfile.code}</span> {p.toProfile.fullName}
                        </Link>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-zinc-500">
                          {p.status === "MEETING_SCHEDULED" && p.meetingAt ? (
                            <span>Meeting {formatDateTime(p.meetingAt)}</span>
                          ) : (
                            <span>{days(p.updatedAt) === 0 ? "Updated today" : `${days(p.updatedAt)} day${days(p.updatedAt) === 1 ? "" : "s"} since update`}</span>
                          )}
                          {flag && <Badge tone="red">follow up</Badge>}
                        </div>
                        <details className="mt-1.5">
                          <summary className="cursor-pointer text-xs font-medium text-brand-700">Update</summary>
                          <div className="mt-2"><ProposalUpdateForm id={p.id} status={p.status} trackMeetings={trackMeetings} /></div>
                        </details>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
