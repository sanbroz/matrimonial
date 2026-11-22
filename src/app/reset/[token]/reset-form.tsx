"use client";

import { useActionState } from "react";
import { Alert, Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { resetPassword } from "@/app/forgot/actions";

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPassword.bind(null, token), undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert>{state.error}</Alert>}
      <Field label="New password" hint="At least 8 characters">
        <input name="password" type="password" autoComplete="new-password" required minLength={8} className={inputClass} />
      </Field>
      <Field label="Repeat new password">
        <input name="confirm" type="password" autoComplete="new-password" required minLength={8} className={inputClass} />
      </Field>
      <SubmitButton pendingText="Saving…" className="w-full">Save new password</SubmitButton>
    </form>
  );
}
