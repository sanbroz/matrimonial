"use client";

import { useFormStatus } from "react-dom";
import { buttonClass, cx } from "./ui";

export function SubmitButton({
  children,
  pendingText = "Saving…",
  variant = "primary",
  className,
  confirm,
  name,
  value,
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: keyof typeof buttonClass;
  className?: string;
  /** Ask the browser to confirm before submitting (e.g. deletes). */
  confirm?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={cx(buttonClass[variant], className)}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? pendingText : children}
    </button>
  );
}
