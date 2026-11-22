"use client";

import { useId, useState } from "react";
import type { ProposalStatus } from "@prisma/client";
import { updateProposalStatus } from "@/app/(staff)/profiles/[id]/matches/actions";
import { PROPOSAL_LABELS } from "@/lib/proposal-labels";
import { Field, inputClass } from "./ui";
import { SubmitButton } from "./submit-button";

type Props = { id: string; status: ProposalStatus };

/**
 * Change stage + note. Extra fields appear for meeting / declined / matched.
 * Keyed by the saved status, so after a save (or a change made elsewhere) the whole form,
 * including the chosen stage, starts again from what is stored.
 */
export function ProposalUpdateForm(props: Props) {
  return <StageForm key={`${props.id}:${props.status}`} {...props} />;
}

function StageForm({ id, status }: Props) {
  const [next, setNext] = useState<ProposalStatus>(status);
  const reasonsId = useId(); // unique per proposal (several forms on one page)
  return (
    <div className="@container">
    <form action={updateProposalStatus} className="grid grid-cols-1 gap-2 @xl:grid-cols-[12rem_1fr_auto] @xl:items-end">
      <input type="hidden" name="id" value={id} />
      <Field label="Stage">
        <select name="status" value={next} onChange={(e) => setNext(e.target.value as ProposalStatus)} className={inputClass}>
          {Object.entries(PROPOSAL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <Field label="Note (optional)">
        <input name="note" placeholder="What did the family say?" className={inputClass} />
      </Field>
      <SubmitButton>{next === status ? "Add note" : "Save"}</SubmitButton>
      {next === "MEETING_SCHEDULED" && (
        <Field label="Meeting date & time" hint="A follow-up is added for the day after" className="@xl:col-span-2">
          <input type="datetime-local" name="meetingAt" className={inputClass + " @xl:w-64!"} />
        </Field>
      )}
      {next === "DECLINED" && (
        <Field label="Reason" className="@xl:col-span-2">
          <input name="declineReason" list={reasonsId} className={inputClass} />
          <datalist id={reasonsId}>
            {["Height", "Age", "Education", "Job / income", "Family background", "Wants NRI", "Does not want NRI", "Kundli did not match", "Photo", "Already engaged elsewhere"].map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>
      )}
      {next === "MATCHED" && status !== "MATCHED" && (
        <div className="space-y-1 @xl:col-span-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="markProfiles" defaultChecked className="size-4 accent-brand-600" />
            Also set both profiles to &quot;Matched&quot; (they stop appearing in suggestions)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="successFees" defaultChecked className="size-4 accent-brand-600" />
            Add success-fee dues for both families (amount from their plan or the bureau default; can be changed later)
          </label>
        </div>
      )}
    </form>
    </div>
  );
}
