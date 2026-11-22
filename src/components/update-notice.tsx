"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buttonClass, cx } from "@/components/ui";

type Running = { version: string; commit: string; builtAt: string | null };
type Status = {
  running: Running;
  available?: { commit: string | null; version: string | null };
  changes?: { commit: string; date: string; subject: string }[] | null;
  updateAvailable?: boolean;
  unavailable?: boolean;
  update?: { status: "idle" | "running" | "success" | "failed"; log: string[] };
  whatsapp?: { installed: string; latest: string | null } | null;
};

const CHECK_EVERY = 15 * 60_000;

/**
 * Version line under "Sign out". For the owner it also checks for a newer release on the
 * server and offers "Back up & update", then follows the update until the new version answers.
 */
export function UpdateNotice({
  initial,
  isOwner,
  screen,
  endpoint = "/api/console/update",
}: {
  initial: Running;
  /** Can install updates (super admin console); bureau staff only see the version */
  isOwner: boolean;
  screen: "desktop" | "mobile";
  endpoint?: string;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [phase, setPhase] = useState<"idle" | "confirm" | "updating" | "done" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const target = useRef<string | null>(null);
  // The layout renders one copy for the sidebar (desktop) and one for the page bottom (phones);
  // only the copy for the current screen size polls the server.
  const [active, setActive] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setActive(mq.matches === (screen === "desktop"));
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [screen]);

  const load = useCallback(async () => {
    try {
      const r = await fetch(endpoint, { cache: "no-store" });
      if (!r.ok) return null;
      const s: Status = await r.json();
      setStatus(s);
      return s;
    } catch {
      return null; // app restarting during an update
    }
  }, [endpoint]);

  useEffect(() => {
    if (!isOwner || !active) return;
    load();
    const t = setInterval(load, CHECK_EVERY);
    return () => clearInterval(t);
  }, [isOwner, active, load]);

  // While updating: poll until the NEW version answers (or the updater reports failure)
  useEffect(() => {
    if (phase !== "updating") return;
    const t = setInterval(async () => {
      const s = await load();
      if (!s) return;
      if (target.current && s.running.commit !== "dev" && target.current.startsWith(s.running.commit.slice(0, 7))) {
        setPhase("done");
        setTimeout(() => window.location.reload(), 2500);
      } else if (s.update?.status === "failed") {
        setPhase("failed");
      }
    }, 3000);
    return () => clearInterval(t);
  }, [phase, load]);

  async function start() {
    if (starting) return;
    setStarting(true);
    setError(null);
    target.current = status?.available?.commit ?? null;
    try {
      const r = await fetch(endpoint, { method: "POST" });
      if (r.status === 202) setPhase("updating");
      else setError((await r.json().catch(() => ({}))).error ?? "Could not start the update");
    } catch {
      setError("Could not reach the server. Check the connection and try again.");
    } finally {
      setStarting(false);
    }
  }

  const running = status?.running ?? initial;
  const label = `v${running.version}${running.commit !== "dev" ? ` · ${running.commit.slice(0, 7)}` : " · dev"}`;
  const showUpdate = isOwner && status?.updateAvailable;
  const changes = status?.changes ?? [];

  return (
    <div className="space-y-1.5">
      <div className="text-[11px] text-zinc-400" title={running.builtAt ? `Built ${new Date(running.builtAt).toLocaleString("en-IN")}` : undefined}>
        {label}
      </div>
      {showUpdate && (
        <button
          type="button"
          onClick={() => {
            setPhase((p) => (p === "updating" ? p : "confirm"));
            dialog.current?.showModal();
          }}
          className="flex w-full items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-left text-xs font-medium text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100"
        >
          <span className="size-2 shrink-0 rounded-full bg-amber-500" />
          Update available
          {status?.available?.version && status.available.version !== running.version
            ? `: v${status.available.version}`
            : changes.length
              ? ` (${changes.length} change${changes.length === 1 ? "" : "s"})`
              : ""}
        </button>
      )}

      {isOwner && status?.whatsapp?.latest && (
        <a
          href="/console/updates"
          className="flex w-full items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1.5 text-left text-xs font-medium text-emerald-900 ring-1 ring-emerald-200 hover:bg-emerald-100"
          title={`WhatsApp library ${status.whatsapp.installed} → ${status.whatsapp.latest}`}
        >
          <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
          WhatsApp update: {status.whatsapp.latest}
        </a>
      )}

      <dialog ref={dialog} className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl p-0 shadow-xl backdrop:bg-black/40">
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base font-semibold">
              {phase === "updating" ? "Updating…" : phase === "done" ? "Updated" : phase === "failed" ? "Update failed" : "Update available"}
            </h2>
            {phase !== "updating" && (
              <button type="button" onClick={() => dialog.current?.close()} className="text-xl leading-none text-zinc-400 hover:text-zinc-700" aria-label="Close">×</button>
            )}
          </div>

          {(phase === "confirm" || phase === "idle") && (
            <>
              <p className="text-sm text-zinc-600">
                Installed: <strong>{label}</strong>. On the server: <strong>{status?.available?.version ? `v${status.available.version} · ` : ""}{status?.available?.commit}</strong>.
              </p>
              {changes.length > 0 && (
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">What&apos;s new ({changes.length})</div>
                  <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
                    {changes.map((c) => (
                      <li key={c.commit}><span className="font-mono text-xs text-zinc-400">{c.commit}</span> {c.subject}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="rounded-md bg-zinc-50 p-3 text-xs text-zinc-600">
                A backup is taken first. The app then rebuilds and restarts, which takes a few minutes; staff
                can&apos;t use it during the last minute. This page reloads when the new version is running.
              </p>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => dialog.current?.close()} className={buttonClass.secondary}>Later</button>
                <button type="button" onClick={start} disabled={starting} className={buttonClass.primary}>{starting ? "Starting…" : "Back up & update now"}</button>
              </div>
            </>
          )}

          {phase === "updating" && (
            <>
              <p className="text-sm text-zinc-600">Backing up, building and restarting. Keep this page open; it reloads by itself.</p>
              <UpdateLog lines={status?.update?.log ?? []} />
            </>
          )}
          {phase === "done" && <p className="text-sm text-emerald-700">The new version is running. Reloading…</p>}
          {phase === "failed" && (
            <>
              <p className="text-sm text-red-700">
                The update did not finish. The previous version keeps running if the new one could not start. See the log below,
                or run the manual steps in UPDATE.md on the server.
              </p>
              <UpdateLog lines={status?.update?.log ?? []} />
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}

function UpdateLog({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    ref.current?.scrollTo(0, ref.current.scrollHeight);
  }, [lines]);
  return (
    <pre ref={ref} className={cx("max-h-56 overflow-auto rounded-md bg-zinc-900 p-3 text-[11px] leading-relaxed text-zinc-100", !lines.length && "text-zinc-500")}>
      {lines.length ? lines.slice(-60).join("\n") : "Waiting for output… (the log pauses while the app restarts)"}
    </pre>
  );
}
