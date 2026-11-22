import type { Plan } from "@prisma/client";
import { requireOwner } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { Badge, Card, Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { savePlan, togglePlan } from "../actions";
import { Flash } from "../flash";

export const metadata = { title: "Membership plans" };

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireOwner();
  const sp = await searchParams;
  const [plans, settings] = await Promise.all([
    prisma.plan.findMany({ orderBy: [{ active: "desc" }, { price: "asc" }] }),
    prisma.settings.findUniqueOrThrow({ where: { id: 1 }, select: { successFeeDefault: true } }),
  ]);

  return (
    <div className="space-y-5">
      <Flash {...sp} />
      {plans.map((p) => (
        <Card
          key={p.id}
          title={<span className="flex items-center gap-2">{p.name} {!p.active && <Badge>inactive</Badge>}</span>}
          actions={
            <form action={togglePlan}>
              <input type="hidden" name="id" value={p.id} />
              <SubmitButton variant="ghost" pendingText="…">{p.active ? "Deactivate" : "Activate"}</SubmitButton>
            </form>
          }
        >
          <PlanForm plan={p} defaultSuccess={settings.successFeeDefault} />
        </Card>
      ))}
      <Card title="Add a plan">
        <PlanForm defaultSuccess={settings.successFeeDefault} />
      </Card>
    </div>
  );
}

function PlanForm({ plan, defaultSuccess }: { plan?: Plan; defaultSuccess: number }) {
  return (
    <form action={savePlan} className="grid grid-cols-2 gap-3 sm:grid-cols-6">
      {plan && <input type="hidden" name="id" value={plan.id} />}
      <Field label="Name" className="col-span-2"><input name="name" required defaultValue={plan?.name} placeholder="e.g. Gold 6 months" className={inputClass} /></Field>
      <Field label="Duration (days)"><input name="durationDays" type="number" min={1} required defaultValue={plan?.durationDays ?? 180} className={inputClass} /></Field>
      <Field label="Price (₹)"><input name="price" inputMode="numeric" required defaultValue={plan?.price} className={inputClass} /></Field>
      <Field label="Introductions" hint="Blank = unlimited"><input name="introLimit" type="number" min={0} defaultValue={plan?.introLimit ?? ""} className={inputClass} /></Field>
      <Field label="Success fee (₹)" hint={`Blank = default ${formatMoney(defaultSuccess)}`}><input name="successFee" inputMode="numeric" defaultValue={plan?.successFee ?? ""} className={inputClass} /></Field>
      <Field label="Description" className="col-span-2 sm:col-span-5"><input name="description" defaultValue={plan?.description ?? ""} className={inputClass} /></Field>
      <div className="flex items-end"><SubmitButton>{plan ? "Save" : "Add plan"}</SubmitButton></div>
    </form>
  );
}
