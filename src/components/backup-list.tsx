"use client";

import { useState } from "react";
import { buttonClass, cx, inputClass } from "./ui";
import { SubmitButton } from "./submit-button";

type File = { file: string; created: string; sizeLabel: string };

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

const kind = (f: string) =>
  f.includes("_before-restore") ? "Before a restore" : f.includes("_nightly") ? "Nightly" : f.includes("_final") ? "Final" : "Manual";

/**
 * One bureau's backups: download (as a password-protected .7z) and restore.
 * Used by the console and by the bureau owner's Settings → Backups.
 */
export function BackupList({
  files,
  hidden = {},
  restoreAction,
  downloadUrl,
}: {
  files: File[];
  hidden?: Record<string, string>;
  restoreAction: (fd: FormData) => Promise<void>;
  downloadUrl: string;
}) {
  const [open, setOpen] = useState<{ file: string; mode: "download" | "restore" } | null>(null);
  if (!files.length) return <p className="text-sm text-zinc-500">No backups yet.</p>;
  return (
    <ul className="divide-y divide-zinc-100 text-sm">
      {files.map((f) => {
        const isOpen = open?.file === f.file;
        return (
          <li key={f.file} className="py-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium">{fmt(f.created)}</span>
              <span className="text-xs text-zinc-500">{kind(f.file)} · {f.sizeLabel}</span>
              <span className="ml-auto flex gap-1">
                <button type="button" className={buttonClass.ghost} onClick={() => setOpen(isOpen && open?.mode === "download" ? null : { file: f.file, mode: "download" })}>
                  Download
                </button>
                <button type="button" className={cx(buttonClass.ghost, "text-red-700")} onClick={() => setOpen(isOpen && open?.mode === "restore" ? null : { file: f.file, mode: "restore" })}>
                  Restore
                </button>
              </span>
            </div>
            {isOpen && open.mode === "download" && (
              // A normal form POST, so the browser saves the file
              <form method="post" action={downloadUrl} className="mt-2 flex flex-wrap items-end gap-2 rounded-md bg-zinc-50 p-3" onSubmit={() => setTimeout(() => setOpen(null), 500)}>
                <input type="hidden" name="file" value={f.file} />
                <label className="block text-xs text-zinc-600">
                  Choose a password for the download (at least 8 characters)
                  <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass + " mt-1 w-64!"} />
                </label>
                <button className={buttonClass.secondary}>Download .7z</button>
                <p className="w-full text-xs text-zinc-500">
                  Open it with 7-Zip (free) using this password. Keep it safe: it contains your clients&apos; personal details.
                </p>
              </form>
            )}
            {isOpen && open.mode === "restore" && (
              <form action={restoreAction} className="mt-2 flex flex-wrap items-end gap-2 rounded-md bg-red-50 p-3">
                {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
                <input type="hidden" name="file" value={f.file} />
                <label className="block text-xs text-red-800">
                  This replaces ALL current data and files with this backup. Type RESTORE to confirm.
                  <input name="confirm" required autoComplete="off" className={inputClass + " mt-1 w-40!"} />
                </label>
                <SubmitButton variant="danger" pendingText="Restoring… (can take a minute)">Restore this backup</SubmitButton>
              </form>
            )}
          </li>
        );
      })}
    </ul>
  );
}
