// Updater service (internal only). See ops/updater/Dockerfile.
//   GET  /status?since=<commit>  → code on the server, changes since <commit>, last update run
//   POST /update                 → backup + deploy (one at a time)
import { createServer } from "node:http";
import { execFile, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { timingSafeEqual } from "node:crypto";

const REPO = "/repo";
const TOKEN = process.env.UPDATER_TOKEN || "";
const PORT = 8787;
if (TOKEN.length < 32) {
  console.error("UPDATER_TOKEN missing or too short; refusing to start");
  process.exit(1);
}

const state = { status: "idle", startedAt: null, finishedAt: null, exitCode: null, log: [] };
const LOG_LINES = 300;

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
  return { head, version, changes, update: { ...state, log: state.log.slice(-80) } };
}

function startUpdate() {
  if (state.status === "running") return false;
  Object.assign(state, { status: "running", startedAt: new Date().toISOString(), finishedAt: null, exitCode: null, log: [] });
  const child = spawn("bash", ["-c", "./ops/backup-now.sh && ./ops/deploy.sh"], {
    cwd: REPO,
    env: { ...process.env, RUNNING_IN_UPDATER: "1" },
  });
  const add = (chunk) => {
    for (const line of chunk.toString().split(/\r?\n/)) if (line.trim()) state.log.push(line);
    if (state.log.length > LOG_LINES) state.log.splice(0, state.log.length - LOG_LINES);
  };
  child.stdout.on("data", add);
  child.stderr.on("data", add);
  child.on("close", (code) => {
    Object.assign(state, { status: code === 0 ? "success" : "failed", exitCode: code, finishedAt: new Date().toISOString() });
    console.log(`update finished: ${state.status}`);
  });
  return true;
}

createServer(async (req, res) => {
  const send = (code, body) => {
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (!authorised(req)) return send(401, { error: "unauthorised" });
  const url = new URL(req.url, "http://updater");
  if (req.method === "GET" && url.pathname === "/status") return send(200, await status(url.searchParams.get("since")));
  if (req.method === "POST" && url.pathname === "/update") {
    return startUpdate() ? send(202, { started: true }) : send(409, { error: "an update is already running" });
  }
  send(404, { error: "not found" });
}).listen(PORT, () => console.log(`updater listening on :${PORT}`));
