import "server-only";
import { headers } from "next/headers";

/**
 * Client IP for rate limiting.
 * - Behind Cloudflare Tunnel (CLIENT_IP_HEADER=cf-connecting-ip): Cloudflare's header holds the visitor's IP.
 *   Safe because the app's port is only reachable through the tunnel.
 * - Otherwise the LAST X-Forwarded-For entry, which our own proxy (Caddy) added, so it can't be spoofed.
 */
export async function clientIp() {
  const h = await headers();
  const trusted = process.env.CLIENT_IP_HEADER?.toLowerCase();
  if (trusted) {
    const v = h.get(trusted);
    if (v) return v.split(",")[0].trim();
  }
  const xff = h.get("x-forwarded-for");
  return xff ? xff.split(",").pop()!.trim() : "local";
}

/**
 * Public base URL for links in emails (password reset).
 * Production: APP_URL only (e.g. https://matrimonial.sanbroz.com). Request headers aren't trusted for this,
 * and behind a tunnel they'd give an http:// link. Returns null when it isn't set.
 * Development: derived from the request.
 */
export async function appBaseUrl(): Promise<string | null> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") return null;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
