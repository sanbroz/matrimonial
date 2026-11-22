// WhatsApp sender for Bureau CRM (internal only, Baileys).
//   GET  /status   → connection state (+ QR code image while linking)
//   POST /send     → { to: "919876543210", text, image?: base64 jpeg }  (queued, one at a time)
//   POST /logout   → unlink the number (a new QR appears)
// Every request needs the X-Whatsapp-Token header (WHATSAPP_TOKEN). Not published on any port.
import { createServer } from "node:http";
import { rm, mkdir } from "node:fs/promises";
import { timingSafeEqual } from "node:crypto";
import makeWASocket, { Browsers, DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from "baileys";
import QRCode from "qrcode";
import pino from "pino";

const TOKEN = process.env.WHATSAPP_TOKEN || "";
const AUTH_DIR = "/data/auth";
const PORT = 8788;
const MIN_GAP_MS = 4000; // between messages, plus random extra: look like a person, not a bot
if (TOKEN.length < 32) {
  console.error("WHATSAPP_TOKEN missing or too short; refusing to start");
  process.exit(1);
}

const logger = pino({ level: process.env.LOG_LEVEL || "warn" });

// Recently sent messages, so Baileys can answer a recipient's retry request
// (otherwise they may see "Waiting for this message").
const sentStore = new Map();
const SENT_KEEP = 500;
function remember(msg) {
  const id = msg?.key?.id;
  if (!id || !msg.message) return;
  sentStore.set(id, msg.message);
  if (sentStore.size > SENT_KEEP) sentStore.delete(sentStore.keys().next().value);
}
const state = { status: "starting", qr: null, me: null, lastError: null, since: new Date().toISOString() };
// Image previews (thumbnails) need sharp; report it so problems are visible
const sharpOk = await import("sharp").then(() => true).catch((e) => {
  console.error("[wa] sharp not available, images will be sent without a preview:", e.message);
  return false;
});
let sock = null;
let retry = 0;

function setStatus(status, extra = {}) {
  Object.assign(state, { status, since: new Date().toISOString() }, extra);
  console.log(`[wa] ${status}${extra.lastError ? `: ${extra.lastError}` : ""}`);
}

async function connect() {
  await mkdir(AUTH_DIR, { recursive: true });
  const { state: auth, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  let version;
  try {
    ({ version } = await fetchLatestBaileysVersion());
  } catch {
    /* use the library default */
  }
  sock = makeWASocket({
    auth,
    version,
    logger,
    browser: Browsers.ubuntu("Bureau CRM"),
    markOnlineOnConnect: false,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    getMessage: async (key) => sentStore.get(key.id) ?? undefined,
  });
  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", async (u) => {
    if (u.qr) {
      setStatus("qr", { qr: await QRCode.toDataURL(u.qr, { margin: 1, width: 280 }), me: null });
    }
    if (u.connection === "connecting" && state.status !== "qr") setStatus("connecting");
    if (u.connection === "open") {
      retry = 0;
      setStatus("open", { qr: null, lastError: null, me: { id: sock.user?.id ?? null, name: sock.user?.name ?? null } });
    }
    if (u.connection === "close") {
      const code = u.lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        // Unlinked from the phone (or via /logout): forget the session and show a fresh QR
        await rm(AUTH_DIR, { recursive: true, force: true });
        setStatus("logged_out", { qr: null, me: null, lastError: "Unlinked from the phone" });
        setTimeout(connect, 2000);
      } else {
        retry++;
        const wait = Math.min(60_000, 2000 * 2 ** Math.min(retry, 5));
        setStatus("connecting", { lastError: u.lastDisconnect?.error?.message ?? `closed (${code})` });
        setTimeout(connect, wait);
      }
    }
  });
}

// ───────────── send queue ─────────────
let queue = Promise.resolve();
let lastSent = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function enqueue(job) {
  const run = queue.then(async () => {
    const wait = lastSent + MIN_GAP_MS + Math.random() * 3000 - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      return await job();
    } finally {
      lastSent = Date.now();
    }
  });
  queue = run.catch(() => {});
  return run;
}

async function send({ to, text, image }) {
  if (state.status !== "open" || !sock) throw Object.assign(new Error("WhatsApp is not connected. Link the number in Settings → WhatsApp."), { code: 503 });
  const digits = String(to || "").replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) throw Object.assign(new Error("Invalid phone number"), { code: 400 });
  return enqueue(async () => {
    const [found] = await sock.onWhatsApp(digits);
    if (!found?.exists) throw Object.assign(new Error(`+${digits} is not on WhatsApp`), { code: 422 });
    const jid = found.jid;
    await sock.sendPresenceUpdate("composing", jid).catch(() => {});
    await sleep(800 + Math.random() * 1200);
    const content = image ? { image: Buffer.from(image, "base64"), caption: text || undefined } : { text };
    const msg = await sock.sendMessage(jid, content);
    remember(msg);
    await sock.sendPresenceUpdate("paused", jid).catch(() => {});
    return { id: msg?.key?.id ?? null, jid };
  });
}

// ───────────── HTTP ─────────────
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
        reject(Object.assign(new Error("Too large"), { code: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(Object.assign(new Error("Bad JSON"), { code: 400 }));
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
    if (req.method === "GET" && req.url === "/status") return reply(200, { ...state, thumbnails: !!sharpOk });
    if (req.method === "POST" && req.url === "/send") return reply(200, await send(await readJson(req)));
    if (req.method === "POST" && req.url === "/logout") {
      if (sock && state.status === "open") await sock.logout().catch(() => {});
      else {
        await rm(AUTH_DIR, { recursive: true, force: true });
        sock?.end?.(undefined);
      }
      return reply(200, { ok: true });
    }
    reply(404, { error: "not found" });
  } catch (e) {
    reply(e.code && e.code >= 400 && e.code < 600 ? e.code : 500, { error: e.message || "error" });
  }
}).listen(PORT, () => console.log(`[wa] listening on :${PORT}`));

connect().catch((e) => {
  setStatus("closed", { lastError: e.message });
  setTimeout(connect, 10_000);
});
