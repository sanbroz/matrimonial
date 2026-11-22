// Backup service for Bureau CRM (internal only). Main process of the backup container:
//  - nightly at BACKUP_TIME (India time): the full encrypted backup, then one backup per bureau
//  - HTTP API for the app (super admin console and bureau owners), with the X-Backup-Token header:
//      GET  /full                       → full backups [{ file, size, created }]
//      POST /full                       → take a full backup now
//      GET  /t/<slug>                   → that bureau's backups
//      POST /t/<slug>/backup  {schema, label?}        → back up now → { file }
//      POST /t/<slug>/restore {schema, file}          → safety backup, then restore → { safety }
//      POST /t/<slug>/export  {file, password}        → password-protected .7z download (binary)
// The backup passphrase stays in this container; the app never sees it.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readdir, stat, rm, mkdtemp } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { timingSafeEqual } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";

const TOKEN = process.env.BACKUP_TOKEN || "";
const PORT = 8789;
const SLUG_RE = /^[a-z][a-z0-9-]{1,29}$/;
const SCHEMA_RE = /^t_[a-z0-9_]{1,40}$/;
const FILE_RE = /^[a-z0-9_-]+\.tar\.enc$/;
const TIME = process.env.BACKUP_TIME || "02:30";

// One backup/restore at a time (they're heavy, and a restore must not overlap a backup of the same bureau)
let chain = Promise.resolve();
const serial = (fn) => {
  const run = chain.then(fn);
  chain = run.catch(() => {});
  return run;
};

function sh(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { env: { ...process.env, ...env } });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error((err.trim() || out.trim()).split("\n").slice(-3).join(" ") || `exit ${code}`));
    });
  });
}

async function list(dir, filter = () => true) {
  let names;
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const files = [];
  for (const n of names.filter((n) => n.endsWith(".tar.enc") && filter(n))) {
    const s = await stat(path.join(dir, n));
    files.push({ file: n, size: s.size, created: s.mtime.toISOString() });
  }
  return files.sort((a, b) => b.created.localeCompare(a.created));
}

/** Bureaus (slug, schema) from the platform database. */
async function tenants() {
  const out = await sh("psql", ["-h", "db", "-U", "matri", "-d", "matrimonial", "-At", "-F", " ", "-c", `SELECT slug, schema FROM platform."Tenant" ORDER BY "createdAt"`], {
    PGPASSWORD: process.env.POSTGRES_PASSWORD,
  });
  return out.split("\n").filter(Boolean).map((l) => {
    const [slug, schema] = l.split(" ");
    return { slug, schema };
  });
}

const tenantBackup = (slug, schema, label = "") => serial(() => sh("/usr/local/bin/tenant-backup.sh", [slug, schema, label])).then((o) => o.split("\n").pop());

async function nightly() {
  console.log(`${new Date().toISOString()} nightly backups starting`);
  try {
    await serial(() => sh("/usr/local/bin/backup.sh"));
  } catch (e) {
    console.error("FULL BACKUP FAILED:", e.message);
  }
  try {
    for (const t of await tenants()) {
      try {
        console.log(`  ${t.slug}: ${await tenantBackup(t.slug, t.schema, "nightly")}`);
      } catch (e) {
        console.error(`  ${t.slug}: BACKUP FAILED: ${e.message}`);
      }
    }
  } catch (e) {
    console.error("could not list bureaus:", e.message);
  }
}

function scheduleNightly() {
  const [h, m] = TIME.split(":").map(Number);
  const now = new Date();
  const next = new Date(now);
  next.setHours(h, m, 0, 0); // TZ=Asia/Kolkata is set for this container
  if (next <= now) next.setDate(next.getDate() + 1);
  setTimeout(async () => {
    await nightly();
    scheduleNightly();
  }, next - now);
  console.log(`next nightly backup: ${next.toString()}`);
}

// ───────────── HTTP ─────────────
function authorised(req) {
  const got = Buffer.from(req.headers["x-backup-token"] || "");
  const want = Buffer.from(TOKEN);
  return want.length >= 32 && got.length === want.length && timingSafeEqual(got, want);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 64 * 1024) req.destroy();
      else chunks.push(c);
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

const bad = (m) => Object.assign(new Error(m), { code: 400 });

createServer(async (req, res) => {
  const reply = (code, body) => {
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (!authorised(req)) return reply(401, { error: "unauthorised" });
  try {
    const url = req.url ?? "";
    if (url === "/full" && req.method === "GET") return reply(200, await list("/backups"));
    if (url === "/full" && req.method === "POST") {
      await serial(() => sh("/usr/local/bin/backup.sh"));
      return reply(200, { ok: true });
    }
    const m = url.match(/^\/t\/([a-z0-9-]+)(?:\/(backup|restore|export))?$/);
    if (!m || !SLUG_RE.test(m[1])) return reply(404, { error: "not found" });
    const [, slug, action] = m;
    const dir = `/backups/tenants/${slug}`;
    if (!action && req.method === "GET") return reply(200, await list(dir, (n) => n.startsWith(`${slug}_`)));
    if (req.method !== "POST") return reply(405, { error: "method not allowed" });
    const body = await readJson(req);

    if (action === "backup") {
      if (!SCHEMA_RE.test(body.schema ?? "")) throw bad("bad schema");
      return reply(200, { file: await tenantBackup(slug, body.schema, /^[a-z0-9-]{1,20}$/.test(body.label ?? "") ? body.label : "") });
    }
    if (action === "restore") {
      if (!SCHEMA_RE.test(body.schema ?? "") || !FILE_RE.test(body.file ?? "")) throw bad("bad request");
      // Safety copy of the current data first, so a restore can itself be undone
      const safety = await tenantBackup(slug, body.schema, "before-restore");
      await serial(() => sh("/usr/local/bin/tenant-restore.sh", [slug, body.schema, body.file]));
      return reply(200, { ok: true, safety });
    }
    if (action === "export") {
      if (!FILE_RE.test(body.file ?? "")) throw bad("bad file");
      if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 200) throw bad("password too short");
      const tmp = await mkdtemp(path.join(tmpdir(), "export-"));
      const out = path.join(tmp, "backup.7z");
      try {
        await serial(() => sh("/usr/local/bin/tenant-export.sh", [slug, body.file, out], { EXPORT_PASSWORD: body.password }));
        const { size } = await stat(out);
        res.writeHead(200, { "content-type": "application/x-7z-compressed", "content-length": size });
        await new Promise((resolve, reject) => createReadStream(out).on("error", reject).on("end", resolve).pipe(res));
      } finally {
        await rm(tmp, { recursive: true, force: true });
      }
      return;
    }
    reply(404, { error: "not found" });
  } catch (e) {
    if (!res.headersSent) reply(e.code >= 400 && e.code < 600 ? e.code : 500, { error: e.message || "error" });
    else res.destroy();
  }
}).listen(PORT, () => console.log(`[backup] listening on :${PORT}`));

if (TOKEN.length < 32) console.error("BACKUP_TOKEN missing: the app can't reach the backup service (nightly backups still run)");
scheduleNightly();
