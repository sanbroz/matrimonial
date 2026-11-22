"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, buttonClass, cx } from "@/components/ui";

type Library = {
  installed: string;
  pinned: string;
  latest: string | null;
  updateAvailable: boolean;
  checkedAt: string | null;
  checkError: string | null;
  waWebVersion: string | null;
  waWebIsLatest: boolean | null;
};
type Run = {
  status: "idle" | "running" | "success" | "failed";
  target: string | null;
  from: string | null;
  rolledBack: boolean;
  message: string | null;
  finishedAt: string | null;
  log: string[];
};
type Info = {
  connection: string;
  library: Library | null;
  updater: { run: Run; override: string; previous: string; busy: string | null } | null;
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "";

/** WhatsApp library (Baileys) version, update / roll back, live progress. */
export function LibraryCard() {
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/whatsapp/library", { cache: "no-store" });
      if (r.ok) setInfo(await r.json());
    } catch {
      /* WhatsApp service restarting during an update */
    }
  }, []);

  const running = info?.updater?.run.status === "running";
  // From the click until the run finishes, poll fast (the updater may take a moment to report "running")
  const [watching, setWatching] = useState(false);
  const fast = running || watching;
  useEffect(() => {
    load();
    const t = setInterval(load, fast ? 3000 : 60_000);
    return () => clearInterval(t);
  }, [load, fast]);
  // Finished → reload so the sidebar / dashboard notices update too
  const wasRunning = useRef(false);
  useEffect(() => {
    if (running) wasRunning.current = true;
    else if (wasRunning.current && info?.updater?.run.status !== "idle") {
      wasRunning.current = false;
      setWatching(false);
      setTimeout(() => window.location.reload(), 2500);
    }
  }, [running, info]);

  async function act(body: { action: string; version?: string | null }, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(null);
    const r = await fetch("/api/whatsapp/library", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok && j.error) setError(j.error);
    if (r.ok && body.action !== "check") setWatching(true);
    await load();
  }

  if (!info) return <p className="text-sm text-zinc-500">Loading…</p>;
  const lib = info.library;
  if (!lib) return <p className="text-sm text-zinc-500">The WhatsApp service isn&apos;t running in this installation.</p>;
  const run = info.updater?.run;

  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
        <div>Installed: <strong>{lib.installed}</strong></div>
        <div>
          Latest release: <strong>{lib.latest ?? "unknown"}</strong>{" "}
          {lib.updateAvailable ? <Badge tone="amber">Update available</Badge> : lib.latest && <Badge tone="green">Up to date</Badge>}
        </div>
        <div className="text-zinc-500">WhatsApp Web protocol: {lib.waWebVersion ?? "unknown"}</div>
        <div className="text-zinc-500">
          Last checked {fmt(lib.checkedAt)}
          {lib.checkError && <span className="text-red-600"> ({lib.checkError})</span>}
        </div>
      </div>

      {run && run.status !== "idle" && (
        <div className={cx("rounded-md p-3", run.status === "running" ? "bg-sky-50" : run.status === "success" ? "bg-emerald-50" : "bg-red-50")}>
          <div className="font-medium">
            {run.status === "running"
              ? `Updating ${run.from ?? ""} → ${run.target}… WhatsApp is paused for a few minutes.`
              : run.message ?? (run.status === "success" ? "Updated." : "Update failed.")}
          </div>
          {run.finishedAt && <div className="text-xs text-zinc-500">{fmt(run.finishedAt)}</div>}
          {(run.status === "running" || run.status === "failed") && run.log.length > 0 && (
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-zinc-900 p-2 text-[11px] text-zinc-100">{run.log.slice(-30).join("\n")}</pre>
          )}
        </div>
      )}

      {error && <p className="text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {lib.updateAvailable && lib.latest && (
          <button
            type="button"
            disabled={running || !!info.updater?.busy}
            onClick={() =>
              act(
                { action: "update", version: lib.latest },
                `Update the WhatsApp library to ${lib.latest}?\n\nWhatsApp pauses for a few minutes. If it can't reconnect, the previous version is restored automatically.`,
              )
            }
            className={buttonClass.primary}
          >
            Update to {lib.latest}
          </button>
        )}
        {info.updater?.previous && info.updater.previous !== lib.installed && (
          <button
            type="button"
            disabled={running || !!info.updater?.busy}
            onClick={() => act({ action: "rollback" }, `Go back to version ${info.updater!.previous}?`)}
            className={buttonClass.secondary}
          >
            Roll back to {info.updater.previous}
          </button>
        )}
        <button
          type="button"
          disabled={checking || running}
          onClick={async () => {
            setChecking(true);
            await act({ action: "check" });
            setChecking(false);
          }}
          className={buttonClass.ghost}
        >
          {checking ? "Checking…" : "Check for updates now"}
        </button>
      </div>
    </div>
  );
}
