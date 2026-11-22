"use client";

import { useEffect, useState } from "react";
import { buttonClass } from "./ui";

/** Submits the form with this id whenever one of its fields changes (option forms with a live preview). */
export function AutoSubmit({ formId }: { formId: string }) {
  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const onChange = () => form.requestSubmit();
    form.addEventListener("change", onChange);
    return () => form.removeEventListener("change", onChange);
  }, [formId]);
  return null;
}

export function CopyButton({ text, label = "Copy link" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass.secondary}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          window.prompt("Copy the link:", text);
        }
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}

/**
 * Sticky bar for check-box selections (profiles list, suggested matches). The check boxes belong to
 * the GET form with this id (form attribute), so submitting opens /share?id=…&id=….
 */
export function SelectionBar({
  formId,
  label,
  second,
}: {
  formId: string;
  label: string;
  /** Another action on the same selection (a server action) */
  second?: { label: string; action: (fd: FormData) => Promise<void> };
}) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => setCount(document.querySelectorAll(`input[type=checkbox][form="${formId}"][name=id]:checked`).length);
    update();
    document.addEventListener("change", update);
    return () => document.removeEventListener("change", update);
  }, [formId]);
  if (count === 0) return null;
  return (
    <div className="sticky bottom-3 z-20 mx-auto mt-4 flex w-fit items-center gap-3 rounded-full border border-zinc-200 bg-white px-4 py-2 shadow-lg">
      <span className="text-sm font-medium">{count} selected</span>
      <button type="submit" form={formId} className={buttonClass.primary}>{label}</button>
      {second && (
        <button type="submit" form={formId} formAction={second.action} className={buttonClass.secondary}>{second.label}</button>
      )}
      <button
        type="button"
        className={buttonClass.ghost}
        onClick={() => {
          document.querySelectorAll<HTMLInputElement>(`input[type=checkbox][form="${formId}"][name=id]`).forEach((c) => (c.checked = false));
          setCount(0);
        }}
      >
        Clear
      </button>
    </div>
  );
}
