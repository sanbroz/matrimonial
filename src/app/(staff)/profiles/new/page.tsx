import { requireUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { loadOptions } from "@/lib/services/profiles";
import { hiddenProfileFields } from "@/lib/services/workflow";
import { PageHeader } from "@/components/ui";
import type { FormValues } from "@/lib/profile-form-values";
import { ProfileForm } from "../profile-form";
import { createProfileAction } from "../actions";

export const metadata = { title: "New profile" };

export default async function NewProfilePage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  await requireUser();
  const { lead: leadId } = await searchParams;
  const [options, lead] = await Promise.all([
    loadOptions(),
    leadId ? prisma.lead.findUnique({ where: { id: leadId } }) : null,
  ]);

  const initial: FormValues = { status: "ACTIVE", country: "India" };
  if (lead && !lead.profileId) {
    const forSelf = !lead.forWhom || /self/i.test(lead.forWhom);
    if (forSelf) initial.fullName = lead.name;
    initial.contactName = lead.name;
    if (lead.forWhom && !forSelf) {
      // forWhom describes the candidate ("Son"); the contact's relation is the reverse.
      const w = lead.forWhom.toLowerCase();
      initial.contactRelation = /son|daughter/.test(w) ? "Parent" : /brother|sister/.test(w) ? "Sibling" : `Relative (${lead.forWhom})`;
      if (/son\b|brother|nephew/.test(w) && !lead.gender) initial.gender = "MALE";
      if (/daughter|sister|niece/.test(w) && !lead.gender) initial.gender = "FEMALE";
    }
    initial.phone = lead.phone;
    if (lead.altPhone) initial.altPhone = lead.altPhone;
    if (lead.gender) initial.gender = lead.gender;
    if (lead.city) initial.city = lead.city;
  }

  return (
    <>
      <PageHeader
        title="New profile"
        subtitle={lead ? `Converting lead: ${lead.name}. Their notes and follow-ups will move to the new profile.` : "A profile code is assigned automatically when you save."}
      />
      <ProfileForm
        action={createProfileAction}
        initial={initial}
        options={options}
        leadId={lead && !lead.profileId ? lead.id : undefined}
        cancelHref={lead ? `/leads/${lead.id}` : "/profiles"}
        hiddenFields={await hiddenProfileFields()}
        submitLabel="Create profile"
      />
    </>
  );
}
