"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Alert, Card, Field, buttonClass, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { SOURCE_LABELS } from "@/lib/lead-labels";
import type { LeadFormState } from "./actions";

export function LeadForm({
  action,
  initial,
  isEdit,
  cancelHref,
}: {
  action: (p: LeadFormState, fd: FormData) => Promise<LeadFormState>;
  initial: Record<string, string>;
  isEdit?: boolean;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const v = state.values ?? initial;
  return (
    // key: remount after a failed save (keep typed values) AND after a successful save, so the
    // selects show what was saved (React resets forms to their first-render defaults otherwise)
    <form key={`${state.ts ?? 0}:${JSON.stringify(initial)}`} action={formAction} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      <Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name of person enquiring *">
            <input name="name" defaultValue={v.name} required className={inputClass} />
          </Field>
          <Field label="Match is for">
            <input name="forWhom" defaultValue={v.forWhom} list="forWhom" placeholder="Self, son, daughter…" className={inputClass} />
            <datalist id="forWhom">
              {["Self", "Son", "Daughter", "Brother", "Sister", "Nephew", "Niece", "Relative", "Friend"].map((x) => <option key={x} value={x} />)}
            </datalist>
          </Field>
          <Field label="Phone *">
            <input name="phone" type="tel" defaultValue={v.phone} required className={inputClass} />
          </Field>
          <Field label="Alternate phone">
            <input name="altPhone" type="tel" defaultValue={v.altPhone} className={inputClass} />
          </Field>
          <Field label="Source">
            <select name="source" defaultValue={v.source ?? "PHONE"} className={inputClass}>
              {Object.entries(SOURCE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <Field label="Looking for a match for a">
            <select name="gender" defaultValue={v.gender ?? ""} className={inputClass}>
              <option value="">Not known yet</option>
              <option value="MALE">Groom (boy)</option>
              <option value="FEMALE">Bride (girl)</option>
            </select>
          </Field>
          <Field label="City / village">
            <input name="city" defaultValue={v.city} className={inputClass} />
          </Field>
          {isEdit ? (
            <Field label="Status">
              <select name="status" defaultValue={v.status ?? "NEW"} className={inputClass}>
                <option value="NEW">New</option>
                <option value="FOLLOW_UP">Follow up</option>
                <option value="CONVERTED">Converted</option>
                <option value="LOST">Lost</option>
              </select>
            </Field>
          ) : (
            <Field label="Call back on (optional)">
              <input name="followUpAt" type="datetime-local" className={inputClass} />
            </Field>
          )}
          <Field label="Details / requirements" className="sm:col-span-2">
            <textarea name="details" rows={3} defaultValue={v.details} className={inputClass} />
          </Field>
          {isEdit && (
            <Field label="Reason if lost" className="sm:col-span-2">
              <input name="lostReason" defaultValue={v.lostReason} className={inputClass} />
            </Field>
          )}
        </div>
      </Card>
      <div className="flex gap-2">
        <SubmitButton>{isEdit ? "Save lead" : "Add lead"}</SubmitButton>
        <Link href={cancelHref} className={buttonClass.secondary}>Cancel</Link>
      </div>
    </form>
  );
}
