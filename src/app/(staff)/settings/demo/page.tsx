import { requireOwner } from "@/lib/auth/server";
import { currentDemoCounts } from "@/lib/services/demo";
import { Card, Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { Flash } from "../flash";
import { deleteDemo, loadDemo } from "./actions";

export const metadata = { title: "Demo data" };

export default async function DemoDataPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireOwner();
  const sp = await searchParams;
  const c = await currentDemoCounts();
  return (
    <div className="space-y-5">
      <Flash {...sp} />
      {c.any ? (
        <Card title="Demo data is loaded">
          <p className="mb-2 text-sm text-zinc-700">
            This CRM contains sample data to try things out: <strong>{c.profiles} profiles</strong>, <strong>{c.leads} leads</strong>
            {c.plans > 0 && <>, <strong>{c.plans} sample plans</strong></>}, with their notes, follow-ups, proposals, memberships and receipts.
          </p>
          <p className="mb-4 text-sm text-zinc-600">
            When you&apos;re ready to start with your real clients, delete it. Only the sample records go; anything you added yourself
            stays. If nothing else is left, profile codes and receipt numbers start again from the beginning.
          </p>
          <form action={deleteDemo} className="flex flex-wrap items-end gap-2 rounded-md bg-red-50 p-3">
            <Field label="Type DELETE DEMO to confirm">
              <input name="confirm" required autoComplete="off" className={inputClass + " w-48!"} />
            </Field>
            <SubmitButton variant="danger" pendingText="Deleting…">Delete demo data</SubmitButton>
          </form>
        </Card>
      ) : (
        <Card title="Try the CRM with demo data">
          <p className="mb-2 text-sm text-zinc-700">
            Adds 40 sample Indian / Punjabi profiles (Sikh, Hindu, Christian and Muslim families; Punjab, Chandigarh, Delhi,
            Haryana and NRIs in Canada, the UK, Australia and the USA; some second marriages), 8 leads, notes, follow-ups,
            memberships with receipts and dues, and proposals at every stage of the pipeline.
          </p>
          <p className="mb-4 text-sm text-zinc-600">
            Sample phone numbers are 00000 0xxxx and emails end in @example.com, so nothing can reach a real person. You can
            delete all of it here with one click whenever you want.
          </p>
          <form action={loadDemo}>
            <SubmitButton variant="secondary" pendingText="Adding demo data… (a few seconds)">Add demo data</SubmitButton>
          </form>
        </Card>
      )}
    </div>
  );
}
