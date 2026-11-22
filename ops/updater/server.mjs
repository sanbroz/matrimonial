// Updater service (internal only). See ops/updater/Dockerfile.
//   GET  /status?since=<commit>   → code on the server, changes since <commit>, last app update run
//   POST /update                  → app update: backup + deploy
//   GET  /baileys                 → last WhatsApp library update run + versions in .env.production
//   POST /baileys {version}       → install that Baileys version in the WhatsApp container,
//                                   wait for WhatsApp to reconnect, roll back automatically if it doesn't
//   POST /baileys/rollback        → go back to the previous Baileys version
// One job at a time. Every request needs UPDATER_TOKEN.
import { createServer } from "node:http";
import { execFile, spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { timingSafeEqual } from "node:crypto";

const REPO = "/repo";
const ENV_FILE = `${REPO}/.env.production`;
const TOKEN = process.env.UPDATER_TOKEN || "";
const WA_TOKEN = process.env.WHATSAPP_TOKEN || "";
const PORT = 8787;
const LOG_LINES = 300;
const VERSION_RE = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const RECONNECT_WAIT_MS = 3 * 60_000;

if (TOKEN.length < 32) {
  console.error("UPDATER_TOKEN missing or too short; refusing to start");
  process.exit(1);
}

const newRun = () => ({ status: "idle", startedAt: null, finishedAt: null, exitCode: null, log: [] });
const state = newRun(); // app update
const baileys = { ...newRun(), target: null, from: null, rolledBack: false, message: null }; // library update
let busy = null; // "app" | "baileys"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function git(...args) {
  return new Promise((resolve) =>
    execFile("git", ["-C", REPO, ...args], { timeout: 10_000 }, (err, stdout) => resolve(err ? null : stdout.trim())),
  );
}

function authorised(req) {
  const got = Buffer.from(req.headers["x-updater-token"] || "");
  const want = Buffer.from(TOKEN);
  return got.length === want.length && timingSafeEqual(got, want);
}

function logTo(run) {
  return (chunk) => {
    for (const line of chunk.toString().split(/\r?\n/)) if (line.trim()) run.log.push(line);
    if (run.log.length > LOG_LINES) run.log.splice(0, run.log.length - LOG_LINES);
  };
}

/** Run a shell command in the repo, streaming output into run.log. Resolves with the exit code. */
function sh(run, cmd, extraEnv = {}) {
  return new Promise((resolve) => {
    const child = spawn("bash", ["-c", cmd], { cwd: REPO, env: { ...process.env, RUNNING_IN_UPDATER: "1", ...extraEnv } });
    child.stdout.on("data", logTo(run));
    child.stderr.on("data", logTo(run));
    child.on("close", (code) => resolve(code ?? 1));
  });
}

// ───────────── .env.production helpers ─────────────
async function readEnv(key) {
  const text = await readFile(ENV_FILE, "utf8");
  const m = text.match(new RegExp(`^${key}=(.*)$`, "m"));
  return m ? m[1].trim() : "";
}

async function setEnv(key, value) {
  let text = await readFile(ENV_FILE, "utf8");
  const line = `${key}=${value}`;
  if (new RegExp(`^${key}=.*$`, "m").test(text)) text = text.replace(new RegExp(`^${key}=.*$`, "m"), line);
  else text = `${text.replace(/\n?$/, "\n")}${line}\n`;
  await writeFile(ENV_FILE, text);
}

// ───────────── app update ─────────────
async function status(since) {
  const head = await git("rev-parse", "--short", "HEAD");
  let version = null;
  try {
    version = JSON.parse(await readFile(`${REPO}/package.json`, "utf8")).version;
  } catch {}
  let changes = null;
  if (since && /^[0-9a-f]{4,40}$/.test(since) && head && !head.startsWith(since) && !since.startsWith(head)) {
    const out = await git("log", "--no-merges", "--format=%h%x09%cI%x09%s", `${since}..HEAD`);
    changes = out === null ? null : out.split("\n").filter(Boolean).map((l) => {
      const [commit, date, subject] = l.split("\t");
      return { commit, date, subject };
    });
  }
  return { head, version, changes, update: { ...state, log: state.log.slice(-80) }, busy };
}

function startAppUpdate() {
  if (busy) return false;
  busy = "app";
  Object.assign(state, newRun(), { status: "running", startedAt: new Date().toISOString() });
  sh(state, "./ops/backup-now.sh && ./ops/deploy.sh").then((code) => {
    Object.assign(state, { status: code === 0 ? "success" : "failed", exitCode: code, finishedAt: new Date().toISOString() });
    busy = null;
    console.log(`app update finished: ${state.status}`);
  });
  return true;
}

// ───────────── WhatsApp library (Baileys) update ─────────────
/** Library version + every bureau's session ({ library, sessions: [{ slug, status }] }), or null. */
async function waStatus() {
  try {
    const get = (p) => fetch(`http://whatsapp:8788${p}`, { headers: { "x-whatsapp-token": WA_TOKEN }, signal: AbortSignal.timeout(5000) });
    const [l, s] = await Promise.all([get("/library"), get("/sessions")]);
    if (!l.ok || !s.ok) return null;
    return { library: await l.json(), sessions: await s.json() };
  } catch {
    return null;
  }
}
const openSlugs = (st) => (st?.sessions ?? []).filter((x) => x.status === "open").map((x) => x.slug);

const DC = "docker compose --env-file .env.production -f docker-compose.prod.yml";
const rebuildWhatsApp = (run) => sh(run, `${DC} build whatsapp && ${DC} up -d whatsapp`);

/**
 * Wait until the WhatsApp container runs `version` and every bureau that was connected before
 * is connected again (their linked phones must still work with the new library).
 */
async function waitHealthy(version, mustReconnect, run) {
  const until = Date.now() + RECONNECT_WAIT_MS;
  let last = null;
  while (Date.now() < until) {
    await sleep(5000);
    const s = await waStatus();
    if (!s) continue;
    last = s;
    if (s.library?.installed !== version) continue;
    const byslug = new Map(s.sessions.map((x) => [x.slug, x.status]));
    const lost = mustReconnect.filter((slug) => ["qr", "not_linked"].includes(byslug.get(slug)));
    if (lost.length) return { ok: false, why: `the new version asked to link the phone again (${lost.join(", ")})` };
    if (mustReconnect.every((slug) => byslug.get(slug) === "open")) return { ok: true };
  }
  const now = last ? openSlugs(last) : [];
  run.log.push(`[updater] last WhatsApp status: ${last ? `${now.length}/${mustReconnect.length} reconnected (${last.library?.installed})` : "no answer"}`);
  return { ok: false, why: `WhatsApp did not reconnect within ${RECONNECT_WAIT_MS / 60000} minutes` };
}

async function runBaileysUpdate(target, { isRollback = false } = {}) {
  const before = await waStatus();
  const from = before?.library?.installed ?? null;
  const wasConnected = openSlugs(before); // bureaus that must reconnect
  const previousOverride = await readEnv("BAILEYS_VERSION");
  Object.assign(baileys, newRun(), {
    status: "running", startedAt: new Date().toISOString(), target, from, rolledBack: false, message: null,
  });
  const say = (m) => baileys.log.push(`[updater] ${m}`);
  say(`${isRollback ? "Rolling back" : "Updating"} WhatsApp library ${from ?? "?"} → ${target}`);

  await setEnv("BAILEYS_VERSION", target);
  let code = await rebuildWhatsApp(baileys);
  let health = code === 0 ? await waitHealthy(target, wasConnected, baileys) : { ok: false, why: "the build failed" };

  if (health.ok) {
    if (!isRollback && from) await setEnv("BAILEYS_PREVIOUS_VERSION", from);
    Object.assign(baileys, { status: "success", exitCode: 0, message: `WhatsApp library is now ${target}` });
    say(baileys.message);
  } else if (isRollback) {
    Object.assign(baileys, { status: "failed", exitCode: code, message: `Rollback failed: ${health.why}` });
    say(baileys.message);
  } else {
    // Automatic rollback to what was running before
    say(`Problem: ${health.why}. Rolling back to ${from ?? "the previous version"}…`);
    await setEnv("BAILEYS_VERSION", previousOverride);
    code = await rebuildWhatsApp(baileys);
    const back = code === 0 && from ? await waitHealthy(from, wasConnected, baileys) : { ok: code === 0 };
    Object.assign(baileys, {
      status: "failed",
      exitCode: code,
      rolledBack: true,
      message: back.ok
        ? `Update to ${target} failed (${health.why}). Rolled back to ${from}; WhatsApp is working as before.`
        : `Update to ${target} failed (${health.why}) and the rollback did not fully recover. Check the console → Updates.`,
    });
    say(baileys.message);
  }
  baileys.finishedAt = new Date().toISOString();
  busy = null;
}

function startBaileysUpdate(version, opts) {
  if (busy) return { ok: false, error: `another update is running (${busy})` };
  if (!VERSION_RE.test(version || "")) return { ok: false, error: "invalid version" };
  if (WA_TOKEN.length < 32) return { ok: false, error: "WHATSAPP_TOKEN missing for the updater; run ./ops/deploy.sh" };
  busy = "baileys";
  runBaileysUpdate(version, opts).catch((e) => {
    Object.assign(baileys, { status: "failed", message: e.message, finishedAt: new Date().toISOString() });
    busy = null;
  });
  return { ok: true };
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) {
    chunks.push(c);
    if (chunks.reduce((s, x) => s + x.length, 0) > 10_000) break;
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    return {};
  }
}

createServer(async (req, res) => {
  const send = (code, body) => {
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (!authorised(req)) return send(401, { error: "unauthorised" });
  const url = new URL(req.url, "http://updater");
  try {
    if (req.method === "GET" && url.pathname === "/status") return send(200, await status(url.searchParams.get("since")));
    if (req.method === "POST" && url.pathname === "/update") {
      return startAppUpdate() ? send(202, { started: true }) : send(409, { error: `an update is already running (${busy})` });
    }
    if (req.method === "GET" && url.pathname === "/baileys") {
      return send(200, {
        run: { ...baileys, log: baileys.log.slice(-80) },
        override: await readEnv("BAILEYS_VERSION"),
        previous: await readEnv("BAILEYS_PREVIOUS_VERSION"),
        busy,
      });
    }
    if (req.method === "POST" && url.pathname === "/baileys") {
      const r = startBaileysUpdate(String((await readBody(req)).version || ""));
      return send(r.ok ? 202 : 409, r);
    }
    if (req.method === "POST" && url.pathname === "/baileys/rollback") {
      const previous = await readEnv("BAILEYS_PREVIOUS_VERSION");
      if (!previous) return send(409, { ok: false, error: "no previous version recorded" });
      const r = startBaileysUpdate(previous, { isRollback: true });
      return send(r.ok ? 202 : 409, r);
    }
    send(404, { error: "not found" });
  } catch (e) {
    send(500, { error: e.message });
  }
}).listen(PORT, () => console.log(`updater listening on :${PORT}`));
