import "server-only";
import { appVersion } from "./version";

/** Client for the internal updater container (production only). */
const URL_ = process.env.UPDATER_URL;
const TOKEN = process.env.UPDATER_TOKEN;

export const updaterConfigured = !!(URL_ && TOKEN);

export interface UpdateStatus {
  running: typeof appVersion;
  /** Code currently on the server (pushed with `git push prod main`). */
  available: { commit: string | null; version: string | null };
  /** Commits newer than the running build; null when unknown. */
  changes: { commit: string; date: string; subject: string }[] | null;
  updateAvailable: boolean;
  update: { status: "idle" | "running" | "success" | "failed"; startedAt: string | null; finishedAt: string | null; log: string[] };
}

async function call(path: string, init?: RequestInit) {
  return fetch(`${URL_}${path}`, {
    ...init,
    headers: { "x-updater-token": TOKEN!, ...(init?.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
}

export async function getUpdateStatus(): Promise<UpdateStatus | null> {
  if (!updaterConfigured) return null;
  try {
    const res = await call(`/status?since=${encodeURIComponent(appVersion.commit)}`);
    if (!res.ok) return null;
    const s = await res.json();
    const head: string | null = s.head;
    const differs = !!head && !head.startsWith(appVersion.commit) && !appVersion.commit.startsWith(head);
    return {
      running: appVersion,
      available: { commit: head, version: s.version },
      changes: s.changes,
      updateAvailable: differs,
      update: s.update,
    };
  } catch {
    return null;
  }
}

export async function startUpdate(): Promise<{ ok: boolean; error?: string }> {
  if (!updaterConfigured) return { ok: false, error: "Updates are not set up on this server" };
  try {
    const res = await call("/update", { method: "POST" });
    if (res.status === 202) return { ok: true };
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body.error ?? `Updater error ${res.status}` };
  } catch {
    return { ok: false, error: "Could not reach the updater" };
  }
}
