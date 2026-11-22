"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  HEIGHT_OPTIONS,
  MARITAL_LABELS,
  PROFILE_FIELDS,
  SECTIONS,
  inputName,
  type FieldDef,
} from "@/lib/profile-fields";
import type { FormValues } from "@/lib/profile-form-values";
import { Alert, Card, Field, buttonClass, cx, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import type { ProfileFormState } from "./actions";

type Action = (prev: ProfileFormState, fd: FormData) => Promise<ProfileFormState>;

export function ProfileForm({
  action,
  initial,
  options,
  leadId,
  cancelHref,
  submitLabel,
}: {
  action: Action;
  initial: FormValues;
  options: Record<string, string[]>;
  leadId?: string;
  cancelHref: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const values = state.values ?? initial;
  const errors = state.errors ?? {};
  const usedCategories = [...new Set(PROFILE_FIELDS.map((f) => f.options).filter(Boolean))] as string[];

  return (
    // key forces inputs to remount with the submitted values after a failed save
    <form key={state.ts ?? 0} action={formAction} className="space-y-5" noValidate>
      {leadId && <input type="hidden" name="leadId" value={leadId} />}
      {usedCategories.map((c) => (
        <datalist key={c} id={`opt-${c}`}>
          {(options[c] ?? []).map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      ))}

      {state.message && <Alert>{state.message}</Alert>}
      {values.showAllowDuplicate && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="allowDuplicate" /> Save anyway (it is a different person)
        </label>
      )}

      <Card title="Status">
        <div className="flex flex-wrap items-end gap-5">
          <Field label="Profile status" className="w-44">
            <select name="status" defaultValue={String(values.status ?? "ACTIVE")} className={inputClass}>
              <option value="ACTIVE">Active</option>
              <option value="ON_HOLD">On hold</option>
              <option value="MATCHED">Matched</option>
              <option value="CLOSED">Closed</option>
            </select>
          </Field>
          {[
            ["urgent", "Urgent"],
            ["vip", "VIP"],
            ["specialCase", "Special case"],
            ["consentGiven", "Client consent taken"],
          ].map(([k, l]) => (
            <label key={k} className="flex items-center gap-2 pb-2 text-sm">
              <input type="checkbox" name={k} defaultChecked={values[k] === true} className="size-4 accent-brand-600" /> {l}
            </label>
          ))}
        </div>
      </Card>

      {SECTIONS.map((s) => (
        <Card key={s.key} title={s.title}>
          {s.hint && <p className="mb-3 text-xs text-amber-700">{s.hint}</p>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PROFILE_FIELDS.filter((f) => f.section === s.key).map((f) => (
              <Field
                key={inputName(f)}
                label={f.label + (f.required ? " *" : "")}
                error={errors[inputName(f)]}
                className={f.wide || f.type === "textarea" ? "sm:col-span-2 lg:col-span-3" : undefined}
                hint={f.type === "list" ? "Separate with commas" : undefined}
              >
                <FieldInput f={f} value={values[inputName(f)]} />
              </Field>
            ))}
          </div>
        </Card>
      ))}

      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-lg md:border">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link href={cancelHref} className={buttonClass.secondary}>Cancel</Link>
      </div>
    </form>
  );
}

function FieldInput({ f, value }: { f: FieldDef; value: FormValues[string] | undefined }) {
  const name = inputName(f);
  const str = typeof value === "string" ? value : "";
  switch (f.type) {
    case "textarea":
      return <textarea name={name} rows={3} defaultValue={str} className={inputClass} />;
    case "date":
      return <input type="date" name={name} defaultValue={str} className={inputClass} />;
    case "int":
      return <input type="number" inputMode="numeric" name={name} defaultValue={str} className={inputClass} />;
    case "bool":
      return (
        <input type="checkbox" name={name} defaultChecked={value === true} className="mt-2 size-4 accent-brand-600" />
      );
    case "gender":
      return (
        <select name={name} defaultValue={str} className={inputClass}>
          <option value="">Select…</option>
          <option value="MALE">Male (groom)</option>
          <option value="FEMALE">Female (bride)</option>
        </select>
      );
    case "marital":
      return (
        <select name={name} defaultValue={str || "NEVER_MARRIED"} className={inputClass}>
          {Object.entries(MARITAL_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      );
    case "maritalList": {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
          {Object.entries(MARITAL_LABELS).map(([v, l]) => (
            <label key={v} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={name} value={v} defaultChecked={selected.includes(v)} className="size-4 accent-brand-600" /> {l}
            </label>
          ))}
        </div>
      );
    }
    case "height": {
      const known = HEIGHT_OPTIONS.some((o) => String(o.cm) === str);
      return (
        <select name={name} defaultValue={str} className={inputClass}>
          <option value="">Select…</option>
          {!known && str && <option value={str}>{str} cm</option>}
          {HEIGHT_OPTIONS.map((o) => (
            <option key={o.cm} value={o.cm}>{o.label}</option>
          ))}
        </select>
      );
    }
    case "phone":
      return <input type="tel" name={name} defaultValue={str} placeholder="98xxxxxxxx" className={inputClass} />;
    default:
      if (f.choices) {
        return (
          <select name={name} defaultValue={str} className={inputClass}>
            <option value="">Select…</option>
            {f.choices.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        );
      }
      return (
        <input
          name={name}
          defaultValue={str}
          placeholder={f.placeholder}
          list={f.options ? `opt-${f.options}` : undefined}
          autoComplete="off"
          className={cx(inputClass)}
        />
      );
  }
}
