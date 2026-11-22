import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { findProfileByPhone } from "@/lib/services/profiles";
import { PaymentDetailsButtons } from "@/components/payment-details-buttons";
import { FormLinkCard } from "@/components/form-link-card";
import { formatDateTime } from "@/lib/format";
import { Alert, ButtonLink, Card, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { FollowUpsPanel, NotesPanel } from "@/components/activity-panel";
import { LeadForm } from "../lead-form";
import { deleteLeadAction, updateLeadAction } from "../actions";

export const metadata = { title: "Lead" };

export default async function LeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { saved } = await searchParams;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
      followUps: { orderBy: { dueAt: "asc" } },
      profile: { select: { id: true, code: true, fullName: true } },
      createdBy: { select: { name: true } },
    },
  });
  if (!lead) notFound();
  const existing = lead.profile ? null : await findProfileByPhone(lead.phone);

  const initial: Record<string, string> = {
    name: lead.name,
    phone: lead.phone,
    altPhone: lead.altPhone ?? "",
    source: lead.source,
    forWhom: lead.forWhom ?? "",
    gender: lead.gender ?? "",
    city: lead.city ?? "",
    details: lead.details ?? "",
    status: lead.status,
    lostReason: lead.lostReason ?? "",
  };

  return (
    <>
      <PageHeader
        title={`Lead: ${lead.name}`}
        subtitle={`Added ${formatDateTime(lead.createdAt)} by ${lead.createdBy.name}`}
        actions={
          lead.profile ? (
            <ButtonLink href={`/profiles/${lead.profile.id}`}>Open profile {lead.profile.code}</ButtonLink>
          ) : (
            <ButtonLink href={`/profiles/new?lead=${lead.id}`} variant="primary">Convert to profile</ButtonLink>
          )
        }
      />
      <div className="mb-4 space-y-2">
        {saved && <Alert tone="green">Lead saved.</Alert>}
        {existing && (
          <Alert tone="amber">
            This phone number is already on profile{" "}
            <Link href={`/profiles/${existing.id}`} className="underline">{existing.code} ({existing.fullName})</Link>.
          </Alert>
        )}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <LeadForm action={updateLeadAction.bind(null, lead.id)} initial={initial} isEdit cancelHref="/leads" />
          <NotesPanel target={{ leadId: lead.id }} notes={lead.notes} currentUserId={user.id} isOwner={user.role === "OWNER"} />
        </div>
        <div className="space-y-5">
          <FollowUpsPanel target={{ leadId: lead.id }} followUps={lead.followUps} />
          <Card title="Send to this family">
            <PaymentDetailsButtons name={lead.name} phone={lead.phone} leadId={lead.id} profileId={lead.profile?.id} />
          </Card>
          {lead.profile && <FormLinkCard profileId={lead.profile.id} returnTo={`/leads/${lead.id}`} />}
          {user.role === "OWNER" && (
            <Card title="Delete lead">
              <form action={deleteLeadAction}>
                <input type="hidden" name="id" value={lead.id} />
                <SubmitButton variant="danger" confirm="Delete this lead and its notes permanently?">Delete lead</SubmitButton>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
