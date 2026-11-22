"use client";

import { useState } from "react";
import type { ProposalStatus } from "@prisma/client";
import { updateProposalStatus } from "@/app/(staff)/profiles/[id]/matches/actions";
import { PROPOSAL_LABELS } from "@/lib/proposal-labels";
import { Field, inputClass } from "./ui";
import { SubmitButton } from "./submit-button";

/** Change stage + note. Extra fields appear for meeting / declined / matched. */
export function ProposalUpdateForm({ id, status }: { id: string; status: ProposalStatus }) {
  const [next, setNext] = useState<ProposalStatus>(status);
  return (
    // key: remount after save so the select shows the stored status
    <div className="@container">
    <form key={status} action={updateProposalStatus} className="grid grid-cols-1 gap-2 @xl:grid-cols-[12rem_1fr_auto] @xl:items-end">
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
          <input name="declineReason" list="decline-reasons" className={inputClass} />
          <datalist id="decline-reasons">
            {["Height", "Age", "Education", "Job / income", "Family background", "Wants NRI", "Does not want NRI", "Kundli did not match", "Photo", "Already engaged elsewhere"].map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>
      )}
      {next === "MATCHED" && (
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
