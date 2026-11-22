"use client";

import { useState } from "react";
import type { Plan } from "@prisma/client";
import { startMembership } from "@/app/(staff)/payments/actions";
import { Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

/** Start or renew a membership; price defaults to the chosen plan's price. */
export function MembershipForm({ profileId, plans, defaultStart }: { profileId: string; plans: Plan[]; defaultStart: string }) {
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const plan = plans.find((p) => p.id === planId);
  if (!plans.length) return <p className="text-sm text-zinc-500">No active plans. The owner can add plans under Settings → Membership plans.</p>;
  return (
    <form action={startMembership} className="@container">
      <input type="hidden" name="profileId" value={profileId} />
      <div className="grid grid-cols-1 gap-3 @lg:grid-cols-2 @3xl:grid-cols-4">
        <Field label="Plan">
          <select name="planId" value={planId} onChange={(e) => setPlanId(e.target.value)} className={inputClass}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}: ₹{p.price.toLocaleString("en-IN")}, {p.durationDays} days
              </option>
            ))}
          </select>
        </Field>
        <Field label="Start date">
          <input type="date" name="startDate" defaultValue={defaultStart} className={inputClass} />
        </Field>
        <Field label="Price (₹)" hint="Change for a discount">
          {/* key: reset to the plan price when the plan changes */}
          <input key={planId} name="price" inputMode="numeric" defaultValue={plan?.price} className={inputClass} />
        </Field>
        <Field label="Success fee (₹)" hint={plan?.successFee != null ? `Plan: ₹${plan.successFee.toLocaleString("en-IN")}` : "Blank = bureau default"}>
          <input key={planId + "s"} name="successFee" inputMode="numeric" placeholder={plan?.successFee?.toString() ?? ""} className={inputClass} />
        </Field>
        <Field label="Received now (₹)" hint="0 or blank = pay later">
          <input key={planId + "p"} name="payNow" inputMode="numeric" defaultValue={plan?.price} className={inputClass} />
        </Field>
        <Field label="Paid by">
          <select name="mode" className={inputClass} defaultValue="CASH">
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="BANK">Bank transfer</option>
            <option value="CHEQUE">Cheque</option>
            <option value="OTHER">Other</option>
          </select>
        </Field>
        <Field label="UPI / cheque ref.">
          <input name="reference" className={inputClass} />
        </Field>
        <div className="flex items-end"><SubmitButton>Start membership</SubmitButton></div>
      </div>
    </form>
  );
}
