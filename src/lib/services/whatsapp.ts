import "server-only";
import { prisma } from "@/lib/db";
import { toWhatsAppNumber } from "@/lib/wa-number";
import { requireTenant } from "@/lib/tenant/context";

/**
 * Client for the internal WhatsApp container (Baileys). It runs one WhatsApp session per bureau:
 * bureau calls go to /t/<slug>/…, the library (version/update) calls are platform-wide.
 */
const URL_ = process.env.WHATSAPP_URL;
const TOKEN = process.env.WHATSAPP_TOKEN;
export const whatsappConfigured = !!(URL_ && TOKEN);

export interface WhatsAppLibrary {
  installed: string;
  pinned: string;
  latest: string | null;
  updateAvailable: boolean;
  checkedAt: string | null;
  checkError: string | null;
  waWebVersion: string | null;
  waWebIsLatest: boolean | null;
}

export interface WhatsAppStatus {
  status: "not_linked" | "starting" | "qr" | "connecting" | "open" | "logged_out" | "closed" | "unavailable";
  qr: string | null;
  me: { id: string | null; name: string | null } | null;
  lastError: string | null;
  since?: string;
  thumbnails?: boolean;
  library?: WhatsAppLibrary;
}

/** Ask the WhatsApp service to check npm for a newer library now. */
export async function checkLibraryNow(): Promise<void> {
  if (!whatsappConfigured) return;
  await call("/check-latest", { method: "POST" }, 20_000).catch(() => {});
}

async function call(path: string, init?: RequestInit, timeoutMs = 5000) {
  return fetch(`${URL_}${path}`, {
    ...init,
    headers: { "x-whatsapp-token": TOKEN!, "content-type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/** Path for the current bureau's session. */
async function tenantPath(p: string) {
  return `/t/${(await requireTenant()).slug}${p}`;
}

/** Library version info (platform-wide; console). */
export async function getWhatsAppLibrary(): Promise<WhatsAppLibrary | null> {
  if (!whatsappConfigured) return null;
  try {
    const r = await call("/library");
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/** Every bureau's session (console). */
export async function listWhatsAppSessions(): Promise<{ slug: string; status: WhatsAppStatus["status"]; me: WhatsAppStatus["me"] }[] | null> {
  if (!whatsappConfigured) return null;
  try {
    const r = await call("/sessions");
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/** Forget a bureau's WhatsApp session for good (bureau deleted). */
export async function removeWhatsAppSession(slug: string) {
  if (!whatsappConfigured) return;
  await call(`/t/${slug}/remove`, { method: "POST" }, 15_000).catch(() => {});
}

/** Start linking the current bureau's number (a QR code appears in the status). */
export async function startWhatsAppLink() {
  if (!whatsappConfigured) return;
  await call(await tenantPath("/link"), { method: "POST" }, 15_000).catch(() => {});
}

/** The current bureau's WhatsApp connection. */
export async function getWhatsAppStatus(): Promise<WhatsAppStatus> {
  const unavailable = (lastError: string): WhatsAppStatus => ({ status: "unavailable", qr: null, me: null, lastError });
  if (!whatsappConfigured) return unavailable("The WhatsApp service is not part of this installation (development mode).");
  try {
    const r = await call(await tenantPath("/status"));
    return r.ok ? await r.json() : unavailable(`Service error ${r.status}`);
  } catch {
    return unavailable("The WhatsApp service is not responding.");
  }
}

export async function logoutWhatsApp() {
  if (!whatsappConfigured) return;
  await call(await tenantPath("/logout"), { method: "POST" }, 15_000).catch(() => {});
}

export type WaResult = { ok: true; id: string | null } | { ok: false; error: string };

/** Sends one WhatsApp message (optionally with a JPG) and logs it in OutboundMessage. */
export async function sendWhatsApp(input: {
  phone: string;
  text: string;
  image?: Buffer;
  kind: string;
  profileId?: string | null;
  userId?: string | null;
}): Promise<WaResult> {
  const to = toWhatsAppNumber(input.phone);
  let result: WaResult;
  if (!to) result = { ok: false, error: `"${input.phone}" is not a valid mobile number` };
  else if (!whatsappConfigured) result = { ok: false, error: "WhatsApp is not available in this installation" };
  else {
    try {
      // Generous timeout: messages are queued a few seconds apart
      const r = await call(
        await tenantPath("/send"),
        { method: "POST", body: JSON.stringify({ to, text: input.text, image: input.image?.toString("base64") }) },
        120_000,
      );
      const body = await r.json().catch(() => ({}));
      result = r.ok ? { ok: true, id: body.id ?? null } : { ok: false, error: body.error ?? `WhatsApp error ${r.status}` };
    } catch {
      result = { ok: false, error: "The WhatsApp service did not answer in time" };
    }
  }
  await prisma.outboundMessage.create({
    data: {
      channel: "WHATSAPP",
      kind: input.kind,
      to: to ? `+${to}` : input.phone,
      body: input.text.slice(0, 4000),
      hasAttachment: !!input.image,
      status: result.ok ? "SENT" : "FAILED",
      error: result.ok ? null : result.error,
      externalId: result.ok ? result.id : null,
      profileId: input.profileId ?? null,
      createdById: input.userId ?? null,
    },
  });
  return result;
}
