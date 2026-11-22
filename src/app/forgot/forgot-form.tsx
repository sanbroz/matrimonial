"use client";

import { useActionState } from "react";
import { Alert, Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { requestReset } from "./actions";

export function ForgotForm() {
  const [state, action] = useActionState(requestReset, undefined);
  if (state?.done) {
    return (
      <Alert tone="green">
        If an account exists for that email, a reset link is on its way. It works for 1 hour. Check the spam folder too.
      </Alert>
    );
  }
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert>{state.error}</Alert>}
      <Field label="Your email">
        <input key={state?.email ?? ""} name="email" type="email" autoComplete="username" required defaultValue={state?.email} className={inputClass} />
      </Field>
      <SubmitButton pendingText="Sending…" className="w-full">Email me a reset link</SubmitButton>
    </form>
  );
}
