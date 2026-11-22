// WhatsApp sender for Bureau CRM (internal only, Baileys). One WhatsApp session per bureau.
//   GET  /library            → library version info (update notices)
//   POST /check-latest       → check npm for a newer library now
//   GET  /sessions           → [{ slug, status, me }] for every bureau with a session
//   GET  /t/<slug>/status    → that bureau's connection (+ QR code image while linking)
//   POST /t/<slug>/link      → start linking (a QR code appears in the status)
//   POST /t/<slug>/send      → { to: "919876543210", text, image?: base64 jpeg }  (queued, one at a time per bureau)
//   POST /t/<slug>/logout    → unlink that bureau's number
//   POST /t/<slug>/remove    → forget the session entirely (bureau deleted)
// Every request needs the X-Whatsapp-Token header (WHATSAPP_TOKEN). Not published on any port.
import { createServer } from "node:http";
import { rm, mkdir, readdir, rename, access } from "node:fs/promises";
import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import makeWASocket, { Browsers, DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from "baileys";
import { compareVersions } from "./version-tools.mjs";
import QRCode from "qrcode";
import pino from "pino";

const TOKEN = process.env.WHATSAPP_TOKEN || "";
const SESSIONS_DIR = "/data/sessions";
// Before multi-bureau support there was one session in /data/auth; it belongs to this bureau
const LEGACY_AUTH_DIR = "/data/auth";
const LEGACY_SLUG = process.env.WHATSAPP_LEGACY_TENANT || "matrimonial";
const PORT = 8788;
const MIN_GAP_MS = 4000; // between messages, plus random extra: look like a person, not a bot
const QR_TIMEOUT_MS = 5 * 60_000; // stop showing QR codes if nobody scans
const SLUG_RE = /^[a-z][a-z0-9-]{1,29}$/;
if (TOKEN.length < 32) {
  console.error("WHATSAPP_TOKEN missing or too short; refusing to start");
  process.exit(1);
}

const logger = pino({ level: process.env.LOG_LEVEL || "warn" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = (p) => access(p).then(() => true, () => false);

// ───────────── library version (for update notices) ─────────────
const library = {
  installed: JSON.parse(readFileSync(new URL("./node_modules/baileys/package.json", import.meta.url), "utf8")).version,
  pinned: JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).dependencies.baileys,
  latest: null,
  updateAvailable: false,
  checkedAt: null,
  checkError: null,
  /** WhatsApp Web protocol version used for connections, and whether it was the newest */
  waWebVersion: null,
  waWebIsLatest: null,
};

async function checkLatest() {
  try {
    const r = await fetch("https://registry.npmjs.org/baileys", {
      headers: { accept: "application/vnd.npm.install-v1+json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) throw new Error(`npm registry answered ${r.status}`);
    const latest = (await r.json())["dist-tags"]?.latest;
    if (!latest) throw new Error("no latest version on npm");
    Object.assign(library, {
      latest,
      updateAvailable: compareVersions(latest, library.installed) > 0,
      checkedAt: new Date().toISOString(),
      checkError: null,
    });
    if (library.updateAvailable) console.log(`[wa] newer Baileys available: ${latest} (installed ${library.installed})`);
  } catch (e) {
    Object.assign(library, { checkedAt: new Date().toISOString(), checkError: e.message });
  }
}
checkLatest();
setInterval(checkLatest, 6 * 3600_000);

let waVersion = null;
async function protocolVersion() {
  if (waVersion) return waVersion;
  try {
    const v = await fetchLatestBaileysVersion();
    Object.assign(library, { waWebVersion: v.version?.join("."), waWebIsLatest: v.isLatest ?? null });
    waVersion = v.version;
    setTimeout(() => (waVersion = null), 6 * 3600_000); // refresh now and then
  } catch {
    /* use the library default */
  }
  return waVersion ?? undefined;
}

// Image previews (thumbnails) need sharp; report it so problems are visible
const sharpOk = await import("sharp").then(() => true).catch((e) => {
  console.error("[wa] sharp not available, images will be sent without a preview:", e.message);
  return false;
});

// ───────────── sessions ─────────────
/** @type {Map<string, Session>} */
const sessions = new Map();

class Session {
  constructor(slug) {
    this.slug = slug;
    this.dir = `${SESSIONS_DIR}/${slug}`;
    this.state = { status: "starting", qr: null, me: null, lastError: null, since: new Date().toISOString() };
    this.sock = null;
    this.retry = 0;
    this.stopped = false;
    this.qrSince = null;
    this.timer = null;
    // Recently sent messages, so Baileys can answer a recipient's retry request
    this.sent = new Map();
    this.queue = Promise.resolve();
    this.lastSent = 0;
  }

  setStatus(status, extra = {}) {
    Object.assign(this.state, { status, since: new Date().toISOString() }, extra);
    console.log(`[wa:${this.slug}] ${status}${extra.lastError ? `: ${extra.lastError}` : ""}`);
  }

  later(fn, ms) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => !this.stopped && fn().catch((e) => this.setStatus("closed", { lastError: e.message })), ms);
  }

  async connect() {
    if (this.stopped) return;
    await mkdir(this.dir, { recursive: true });
    const { state: auth, saveCreds } = await useMultiFileAuthState(this.dir);
    const sock = makeWASocket({
      auth,
      version: await protocolVersion(),
      logger,
      browser: Browsers.ubuntu("Bureau CRM"),
      markOnlineOnConnect: false,
      // Don't download the full chat history, but keep Baileys' initial sync: it needs it for
      // contact/LID mappings (disabling all sync makes sessions unstable).
      syncFullHistory: false,
      getMessage: async (key) => this.sent.get(key.id) ?? undefined,
    });
    this.sock = sock;
    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", async (u) => {
      if (this.sock !== sock) return; // an old socket
      if (u.qr) {
        this.qrSince ??= Date.now();
        if (Date.now() - this.qrSince > QR_TIMEOUT_MS) {
          await this.forget("The QR code was not scanned in time. Click “Link a WhatsApp number” to try again.");
          return;
        }
        this.setStatus("qr", { qr: await QRCode.toDataURL(u.qr, { margin: 1, width: 280 }), me: null });
      }
      if (u.connection === "connecting" && this.state.status !== "qr") this.setStatus("connecting");
      if (u.connection === "open") {
        this.retry = 0;
        this.qrSince = null;
        this.setStatus("open", { qr: null, lastError: null, me: { id: sock.user?.id ?? null, name: sock.user?.name ?? null } });
      }
      if (u.connection === "close") {
        if (this.stopped) return;
        const code = u.lastDisconnect?.error?.output?.statusCode;
        if (code === DisconnectReason.loggedOut) {
          // Unlinked from the phone (or via /logout): forget the session
          await this.forget(this.state.status === "open" ? "Unlinked from the phone" : null);
        } else {
          this.retry++;
          const wait = Math.min(60_000, 2000 * 2 ** Math.min(this.retry, 5));
          this.setStatus("connecting", { lastError: u.lastDisconnect?.error?.message ?? `closed (${code})` });
          this.later(() => this.connect(), wait);
        }
      }
    });
  }

  /** Stop and delete the login; the bureau shows "No number linked". */
  async forget(lastError) {
    this.stop();
    await rm(this.dir, { recursive: true, force: true });
    sessions.delete(this.slug);
    unlinked.set(this.slug, lastError);
    console.log(`[wa:${this.slug}] session removed${lastError ? `: ${lastError}` : ""}`);
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    try {
      this.sock?.end?.(undefined);
    } catch {}
    this.sock = null;
  }

  async logout() {
    if (this.sock && this.state.status === "open") await this.sock.logout().catch(() => {});
    await this.forget(null);
  }

  enqueue(job) {
    const run = this.queue.then(async () => {
      const wait = this.lastSent + MIN_GAP_MS + Math.random() * 3000 - Date.now();
      if (wait > 0) await sleep(wait);
      try {
        return await job();
      } finally {
        this.lastSent = Date.now();
      }
    });
    this.queue = run.catch(() => {});
    return run;
  }

  async send({ to, text, image }) {
    const sock = this.sock;
    if (this.state.status !== "open" || !sock) throw httpError(503, "WhatsApp is not connected. Link the number in Settings → WhatsApp.");
    const digits = String(to || "").replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) throw httpError(400, "Invalid phone number");
    return this.enqueue(async () => {
      const [found] = await sock.onWhatsApp(digits);
      if (!found?.exists) throw httpError(422, `+${digits} is not on WhatsApp`);
      const jid = found.jid;
      await sock.sendPresenceUpdate("composing", jid).catch(() => {});
      await sleep(800 + Math.random() * 1200);
      const content = image ? { image: Buffer.from(image, "base64"), caption: text || undefined } : { text };
      const msg = await sock.sendMessage(jid, content);
      if (msg?.key?.id && msg.message) {
        this.sent.set(msg.key.id, msg.message);
        if (this.sent.size > 500) this.sent.delete(this.sent.keys().next().value);
      }
      await sock.sendPresenceUpdate("paused", jid).catch(() => {});
      return { id: msg?.key?.id ?? null, jid };
    });
  }
}

/** Bureaus without a session, with the reason it ended (shown once as "lastError"). */
const unlinked = new Map();

function startSession(slug) {
  let s = sessions.get(slug);
  if (s) return s;
  s = new Session(slug);
  sessions.set(slug, s);
  unlinked.delete(slug);
  s.connect().catch((e) => {
    s.setStatus("closed", { lastError: e.message });
    s.later(() => s.connect(), 10_000);
  });
  return s;
}

function statusOf(slug) {
  const s = sessions.get(slug);
  if (s) return { ...s.state, thumbnails: !!sharpOk };
  return { status: "not_linked", qr: null, me: null, lastError: unlinked.get(slug) ?? null, thumbnails: !!sharpOk };
}

/** Move the pre-multi-bureau session into its bureau's folder, then start every saved session. */
async function boot() {
  await mkdir(SESSIONS_DIR, { recursive: true });
  if (await exists(`${LEGACY_AUTH_DIR}/creds.json`)) {
    const target = `${SESSIONS_DIR}/${LEGACY_SLUG}`;
    if (!(await exists(target))) {
      await rename(LEGACY_AUTH_DIR, target);
      console.log(`[wa] moved the existing WhatsApp login to bureau "${LEGACY_SLUG}"`);
    }
  }
  for (const slug of await readdir(SESSIONS_DIR)) {
    if (SLUG_RE.test(slug) && (await exists(`${SESSIONS_DIR}/${slug}/creds.json`))) startSession(slug);
  }
}

// ───────────── HTTP ─────────────
function httpError(code, message) {
  return Object.assign(new Error(message), { code });
}

function authorised(req) {
  const got = Buffer.from(req.headers["x-whatsapp-token"] || "");
  const want = Buffer.from(TOKEN);
  return got.length === want.length && timingSafeEqual(got, want);
}

function readJson(req, limit = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(httpError(413, "Too large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(httpError(400, "Bad JSON"));
      }
    });
  });
}

createServer(async (req, res) => {
  const reply = (code, body) => {
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (!authorised(req)) return reply(401, { error: "unauthorised" });
  try {
    const url = req.url ?? "";
    if (req.method === "GET" && url === "/library") return reply(200, library);
    if (req.method === "POST" && url === "/check-latest") {
      await checkLatest();
      return reply(200, library);
    }
    if (req.method === "GET" && url === "/sessions") {
      return reply(200, [...sessions.values()].map((s) => ({ slug: s.slug, status: s.state.status, me: s.state.me })));
    }
    const m = url.match(/^\/t\/([a-z0-9-]+)\/(status|link|send|logout|remove)$/);
    if (!m || !SLUG_RE.test(m[1])) return reply(404, { error: "not found" });
    const [, slug, action] = m;
    if (req.method === "GET" && action === "status") return reply(200, statusOf(slug));
    if (req.method !== "POST") return reply(405, { error: "method not allowed" });
    if (action === "link") {
      startSession(slug);
      return reply(200, statusOf(slug));
    }
    if (action === "send") {
      const s = sessions.get(slug);
      if (!s) throw httpError(503, "No WhatsApp number is linked. Link one in Settings → WhatsApp.");
      return reply(200, await s.send(await readJson(req)));
    }
    if (action === "logout") {
      await sessions.get(slug)?.logout();
      return reply(200, { ok: true });
    }
    if (action === "remove") {
      const s = sessions.get(slug);
      if (s) await s.forget(null);
      else await rm(`${SESSIONS_DIR}/${slug}`, { recursive: true, force: true });
      unlinked.delete(slug);
      return reply(200, { ok: true });
    }
    reply(404, { error: "not found" });
  } catch (e) {
    reply(e.code && e.code >= 400 && e.code < 600 ? e.code : 500, { error: e.message || "error" });
  }
}).listen(PORT, () => console.log(`[wa] listening on :${PORT}`));

boot().catch((e) => console.error("[wa] startup failed", e));
