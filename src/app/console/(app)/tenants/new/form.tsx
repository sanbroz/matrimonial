"use client";

import { useActionState, useState } from "react";
import { Alert, Card, Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createTenantAction } from "../../../actions";

const toSlug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^[^a-z]+/, "")
    .slice(0, 30);

export function NewTenantForm({ domain }: { domain: string }) {
  const [state, action] = useActionState(createTenantAction, undefined);
  const v = state?.values ?? {};
  const [slug, setSlug] = useState(v.slug ?? "");
  const [touched, setTouched] = useState(!!v.slug);

  return (
    <form action={action} className="max-w-2xl space-y-5">
      {state?.error && <Alert>{state.error}</Alert>}
      <Card title="Bureau">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bureau name" className="sm:col-span-2">
            <input
              name="name"
              required
              defaultValue={v.name}
              className={inputClass}
              onChange={(e) => !touched && setSlug(toSlug(e.target.value))}
            />
          </Field>
          <Field label="Subdomain" hint={`Their address: ${slug || "name"}.${domain}. Can't be changed later.`}>
            <div className="flex items-center gap-1">
              <input
                name="slug"
                required
                value={slug}
                onChange={(e) => {
                  setTouched(true);
                  setSlug(e.target.value.toLowerCase());
                }}
                pattern="[a-z][a-z0-9\-]{1,29}"
                className={inputClass}
                aria-label="Subdomain"
              />
              <span className="shrink-0 text-sm text-zinc-500">.{domain}</span>
            </div>
          </Field>
          <Field label="Status">
            <select name="status" defaultValue={v.status ?? "TRIAL"} className={inputClass}>
              <option value="TRIAL">Trial</option>
              <option value="ACTIVE">Active</option>
            </select>
          </Field>
        </div>
      </Card>
      <Card title="Owner login">
        <p className="mb-3 text-sm text-zinc-600">The bureau owner signs in with this and can then add their own staff.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Owner name"><input name="ownerName" defaultValue={v.ownerName} className={inputClass} /></Field>
          <Field label="Owner email"><input name="ownerEmail" type="email" required defaultValue={v.ownerEmail} className={inputClass} /></Field>
          <Field label="First password" hint="At least 8 characters. Ask them to change it after signing in.">
            <input name="ownerPassword" type="text" required minLength={8} autoComplete="off" className={inputClass} />
          </Field>
        </div>
      </Card>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="demo" defaultChecked className="mt-0.5 size-4 accent-brand-600" />
        <span>
          Add Indian / Punjabi demo data (40 sample profiles, leads, proposals, receipts) so they can try it out.
          <span className="block text-xs text-zinc-500">The owner deletes it with one click (Settings → Demo data) to start with real clients.</span>
        </span>
      </label>
      <p className="text-sm text-zinc-500">Billing (fee, cycle and due date) can be set on the next page.</p>
      <SubmitButton pendingText="Creating the bureau…">Create bureau</SubmitButton>
    </form>
  );
}
