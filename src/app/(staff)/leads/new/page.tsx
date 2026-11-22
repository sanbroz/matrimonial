import { requireUser } from "@/lib/auth/server";
import { PageHeader } from "@/components/ui";
import { LeadForm } from "../lead-form";
import { createLeadAction } from "../actions";

export const metadata = { title: "New lead" };

export default async function NewLeadPage() {
  await requireUser();
  return (
    <>
      <PageHeader title="New lead" subtitle="Log an enquiry. Convert it to a profile once the family registers." />
      <LeadForm action={createLeadAction} initial={{ source: "PHONE" }} cancelHref="/leads" />
    </>
  );
}
