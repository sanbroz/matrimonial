"use client";

import { useActionState } from "react";
import { Alert, Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { FOR_WHOM } from "@/lib/lead-forms";
import type { EnquiryState } from "./actions";

export function EnquiryForm({ action, bureauName }: { action: (prev: EnquiryState, fd: FormData) => Promise<EnquiryState>; bureauName: string }) {
  const [state, formAction] = useActionState(action, undefined);
  if (state?.done) {
    return (
      <div className="py-6 text-center">
        <div className="text-3xl">🙏</div>
        <h2 className="mt-2 text-lg font-semibold">Thank you!</h2>
        <p className="mt-1 text-sm text-zinc-600">{bureauName} will call you soon on the number you gave.</p>
      </div>
    );
  }
  const v = state?.values ?? {};
  const err = (f: string) => (state?.field === f ? state.error : undefined);
  return (
    <form key={JSON.stringify(v)} action={formAction} className="space-y-4">
      {state?.error && !state.field && <Alert>{state.error}</Alert>}
      <Field label="Your name *" error={err("name")}>
        <input name="name" required autoComplete="name" defaultValue={v.name} className={inputClass} />
      </Field>
      <Field label="Mobile number (WhatsApp) *" error={err("phone")} hint="10-digit number, or with + and country code if abroad">
        <input name="phone" type="tel" required autoComplete="tel" inputMode="tel" defaultValue={v.phone} className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="The rishta is for">
          <select name="forWhom" defaultValue={v.forWhom ?? ""} className={inputClass}>
            <option value="">Select…</option>
            {Object.entries(FOR_WHOM).map(([k, o]) => <option key={k} value={k}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="City">
          <input name="city" autoComplete="address-level2" defaultValue={v.city} className={inputClass} />
        </Field>
      </div>
      <Field label="Anything you'd like to tell us (optional)">
        <textarea name="message" rows={3} defaultValue={v.message} placeholder="Age, education, what you are looking for…" className={inputClass} />
      </Field>
      {/* Spam trap: hidden from people, filled in by bots */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consent" className="mt-0.5 size-4 accent-brand-600" />
        <span>
          {bureauName} may contact me on this number by phone or WhatsApp about matches.
          {err("consent") && <span className="block text-red-600">{err("consent")}</span>}
        </span>
      </label>
      <SubmitButton pendingText="Sending…" className="w-full">Send my details</SubmitButton>
    </form>
  );
}
