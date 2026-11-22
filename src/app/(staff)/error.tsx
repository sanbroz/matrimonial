"use client";

import Link from "next/link";
import { useEffect } from "react";
import { buttonClass } from "@/components/ui";

/** Shown instead of Next's bare error screen when something on a staff page fails. */
export default function StaffError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-lg rounded-lg border border-red-200 bg-white p-6 text-center shadow-sm">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-zinc-600">
        The last action could not be completed. Nothing else was changed. Try again, and if it keeps happening, note what you
        were doing{error.digest ? ` and this code: ${error.digest}` : ""}.
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <button type="button" onClick={reset} className={buttonClass.primary}>Try again</button>
        <Link href="/" className={buttonClass.secondary}>Go to dashboard</Link>
      </div>
    </div>
  );
}
