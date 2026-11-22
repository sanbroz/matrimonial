"use client";

import { useActionState } from "react";
import { Alert, Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { consoleLogin } from "../actions";

export function ConsoleLoginForm() {
  const [state, action] = useActionState(consoleLogin, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert>{state.error}</Alert>}
      <Field label="Email">
        <input key={state?.email ?? ""} name="email" type="email" autoComplete="username" required defaultValue={state?.email} className={inputClass} />
      </Field>
      <Field label="Password">
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <SubmitButton pendingText="Signing in…" className="w-full">Sign in</SubmitButton>
    </form>
  );
}
