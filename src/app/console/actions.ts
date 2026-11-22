"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { platform } from "@/lib/platform-db";
import { requireConsoleAdmin } from "@/lib/auth/server";
import { setConsoleCookie } from "@/lib/auth/cookie";
import { CONSOLE_COOKIE } from "@/lib/auth/session";
import { clientIp } from "@/lib/auth/client-ip";
import { loginLimits } from "@/lib/auth/rate-limit";
import { addCycles, type Cycle } from "@/lib/billing";
import { readEmailConfig, summaryOptionsSchema } from "@/lib/email-config";
import { seal } from "@/lib/secret-box";
import { isConsoleRequest } from "@/lib/tenant/context";
import { getTenantById, invalidateTenantCache } from "@/lib/tenant/registry";
import { normalizeHost, classifyHost } from "@/lib/tenant/host";
import { createTenant, deleteTenant, TenantError } from "@/lib/services/tenants";
import { restoreTenantBackup, takeFullBackup, takeTenantBackup } from "@/lib/backups";
import { sendPlatformEmail } from "@/lib/services/platform-email";
import { buildPlatformSummary } from "@/lib/services/billing";
import { savePlatformWhatsAppOptions, readPlatformWhatsAppOptions } from "@/lib/services/wa-library";
import { deleteDemoForCurrentBureau, loadDemoForCurrentBureau } from "@/lib/services/demo";
import { DemoDataError } from "@/lib/demo-data";
import { runAsTenant } from "@/lib/tenant/context";

const DUMMY_HASH = "$2b$10$jPc0LyIrKDV8zfasxi6jgO7Sfa0R5yqB9/8o5sqelufJ.mNcJoov.";
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
/** Redirect with a flash message; the message goes before any #anchor so the page can read it. */
const go = (target: string, msg: string, key: "ok" | "error" = "ok"): never => {
  const [path, hash] = target.split("#");
  redirect(`${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(msg)}${hash ? `#${hash}` : ""}`);
};
const dateOrNull = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null);
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ───────────── sign in / out ─────────────

export async function consoleLogin(_prev: { error?: string; email?: string } | undefined, fd: FormData) {
  if (!(await isConsoleRequest())) return { error: "Not available here." };
  const email = str(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password.", email };
  const ip = await clientIp();
  const key = `console:${email}`;
  const wait = Math.max(loginLimits.email.blockedFor(key), loginLimits.ip.blockedFor(ip));
  if (wait > 0) return { error: `Too many failed attempts. Try again in ${Math.ceil(wait / 60000)} minutes.`, email };
  loginLimits.email.fail(key);
  loginLimits.ip.fail(ip);
  const admin = await platform.superAdmin.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);
  if (!admin || !admin.active || !ok) return { error: "Wrong email or password.", email };
  loginLimits.email.reset(key);
  loginLimits.ip.undo(ip);
  await setConsoleCookie(admin);
  redirect("/console");
}

export async function consoleLogout() {
  (await cookies()).delete(CONSOLE_COOKIE);
  redirect("/console/login");
}

// ───────────── bureaus ─────────────

export async function createTenantAction(_prev: { error?: string; values?: Record<string, string> } | undefined, fd: FormData) {
  await requireConsoleAdmin();
  const values = Object.fromEntries(["slug", "name", "status", "ownerName", "ownerEmail"].map((k) => [k, str(fd, k)]));
  const password = String(fd.get("ownerPassword") ?? "");
  if (!values.name) return { error: "Enter the bureau name.", values };
  if (!/^\S+@\S+\.\S+$/.test(values.ownerEmail)) return { error: "Enter the owner's email address.", values };
  if (password.length < 8) return { error: "The owner's password needs at least 8 characters.", values };
  let id: string;
  let demoNote = "";
  try {
    const t = await createTenant({
      slug: values.slug,
      name: values.name,
      status: values.status === "TRIAL" ? "TRIAL" : "ACTIVE",
      owner: { name: values.ownerName || "Owner", email: values.ownerEmail, password },
    });
    id = t.id;
    if (fd.get("demo") === "on") {
      try {
        const r = await runAsTenant(t, () => loadDemoForCurrentBureau());
        demoNote = ` Demo data added (${r.profiles} profiles); the owner can delete it in Settings → Demo data.`;
      } catch (e) {
        demoNote = ` Demo data could not be added: ${errMsg(e)}`;
      }
    }
  } catch (e) {
    if (!(e instanceof TenantError)) console.error("[console] create bureau failed", e);
    return { error: e instanceof TenantError ? e.message : `Could not create the bureau: ${errMsg(e)}`, values };
  }
  redirect(`/console/tenants/${id}?ok=${encodeURIComponent(`Bureau created. Send the owner their address and login.${demoNote}`)}`);
}

export async function updateTenantDetails(fd: FormData) {
  await requireConsoleAdmin();
  const id = str(fd, "id");
  const path = `/console/tenants/${id}`;
  const name = str(fd, "name");
  if (!name) go(path, "Enter the bureau name", "error");
  const fee = Number(str(fd, "fee") || 0);
  if (!Number.isInteger(fee) || fee < 0) go(path, "The fee must be a whole number of rupees", "error");
  const cycle = z.enum(["MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY"]).safeParse(str(fd, "billingCycle"));
  const autoDays = str(fd, "autoSuspendDays");
  await platform.tenant.update({
    where: { id },
    data: {
      name,
      contactName: str(fd, "contactName") || null,
      contactPhone: str(fd, "contactPhone") || null,
      contactEmail: str(fd, "contactEmail") || null,
      notes: str(fd, "notes") || null,
      planName: str(fd, "planName") || null,
      fee,
      billingCycle: cycle.success ? cycle.data : "MONTHLY",
      nextDueDate: dateOrNull(str(fd, "nextDueDate")),
      autoSuspendDays: autoDays === "" ? null : Math.max(0, Math.min(365, Number(autoDays) || 0)),
    },
  });
  invalidateTenantCache();
  revalidatePath(path);
  go(path, "Saved");
}

export async function setTenantStatus(fd: FormData) {
  await requireConsoleAdmin();
  const id = str(fd, "id");
  const status = z.enum(["TRIAL", "ACTIVE", "SUSPENDED"]).parse(str(fd, "status"));
  await platform.tenant.update({
    where: { id },
    data: { status, suspendedReason: status === "SUSPENDED" ? str(fd, "reason") || "Suspended by the platform" : null },
  });
  invalidateTenantCache();
  revalidatePath(`/console/tenants/${id}`);
  go(`/console/tenants/${id}`, status === "SUSPENDED" ? "Bureau suspended: its staff can't sign in until you resume it" : "Bureau is active");
}

export async function recordTenantPayment(fd: FormData) {
  const admin = await requireConsoleAdmin();
  const id = str(fd, "id");
  const path = `/console/tenants/${id}`;
  const amount = Number(str(fd, "amount"));
  if (!Number.isInteger(amount) || amount <= 0) go(path, "Enter the amount in whole rupees", "error");
  const paidAt = dateOrNull(str(fd, "paidAt"));
  if (!paidAt) go(path, "Enter the payment date", "error");
  const t = await platform.tenant.findUniqueOrThrow({ where: { id } });
  const cycles = Math.max(1, Math.min(24, Number(str(fd, "cycles")) || 1));
  // The payment covers `cycles` billing periods from the current due date (or from today if none)
  const from = t.nextDueDate ?? paidAt!;
  const to = addCycles(from, t.billingCycle as Cycle, cycles);
  await platform.$transaction(async (tx) => {
    await tx.tenantPayment.create({
      data: { tenantId: id, amount, mode: str(fd, "mode") || "UPI", paidAt: paidAt!, periodFrom: from, periodTo: to, note: str(fd, "note") || null, createdBy: admin.name },
    });
    await tx.tenant.update({
      where: { id },
      // Paying brings a bureau suspended for non-payment back automatically
      data: {
        nextDueDate: to,
        ...(t.status === "SUSPENDED" && t.suspendedReason?.startsWith("Payment overdue") ? { status: "ACTIVE", suspendedReason: null } : {}),
      },
    });
  });
  invalidateTenantCache();
  revalidatePath(path);
  go(path, `Payment recorded. Next due date: ${to.toISOString().slice(0, 10)}`);
}

export async function voidTenantPayment(fd: FormData) {
  await requireConsoleAdmin();
  const id = str(fd, "id");
  await platform.tenantPayment.updateMany({ where: { id: str(fd, "paymentId"), tenantId: id, voidedAt: null }, data: { voidedAt: new Date() } });
  revalidatePath(`/console/tenants/${id}`);
  go(`/console/tenants/${id}`, "Payment voided. Adjust the next due date if needed.");
}

export async function addTenantDomain(fd: FormData) {
  await requireConsoleAdmin();
  const id = str(fd, "id");
  const host = normalizeHost(str(fd, "host"));
  const path = `/console/tenants/${id}`;
  if (!/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) go(path, "Enter a domain like crm.yourbureau.in", "error");
  if (classifyHost(host).kind !== "custom") go(path, "Use the bureau's own domain; subdomains of the platform are automatic", "error");
  if (await platform.tenantDomain.findUnique({ where: { host } })) go(path, "That domain is already added", "error");
  await platform.tenantDomain.create({ data: { tenantId: id, host } });
  revalidatePath(path);
  go(path, "Domain added (inactive until custom domains are switched on)");
}

export async function updateTenantDomain(fd: FormData) {
  await requireConsoleAdmin();
  const id = str(fd, "id");
  const domainId = str(fd, "domainId");
  const op = str(fd, "op");
  if (op === "delete") await platform.tenantDomain.deleteMany({ where: { id: domainId, tenantId: id } });
  if (op === "toggle") {
    const d = await platform.tenantDomain.findFirst({ where: { id: domainId, tenantId: id } });
    if (d) await platform.tenantDomain.update({ where: { id: d.id }, data: { active: !d.active, ...(d.active ? { primary: false } : {}) } });
  }
  if (op === "primary") {
    await platform.$transaction(async (tx) => {
      await tx.tenantDomain.updateMany({ where: { tenantId: id }, data: { primary: false } });
      await tx.tenantDomain.updateMany({ where: { id: domainId, tenantId: id, active: true }, data: { primary: true } });
    });
  }
  invalidateTenantCache();
  revalidatePath(`/console/tenants/${id}`);
  go(`/console/tenants/${id}`, "Domains updated");
}

export async function deleteTenantAction(fd: FormData) {
  await requireConsoleAdmin();
  const id = str(fd, "id");
  const t = await getTenantById(id);
  if (!t) go("/console", "Bureau not found", "error");
  if (str(fd, "confirmSlug") !== t!.slug) go(`/console/tenants/${id}`, `Type the subdomain "${t!.slug}" to confirm deleting`, "error");
  let r;
  try {
    r = await deleteTenant(id);
  } catch (e) {
    go(`/console/tenants/${id}`, `Not deleted: ${errMsg(e)}`, "error");
  }
  revalidatePath("/console");
  go("/console", `Bureau "${t!.slug}" deleted${r?.finalBackup ? `. Final backup kept: ${r.finalBackup}` : ""}`);
}

// ───────────── backups ─────────────

export async function backupTenantNow(fd: FormData) {
  await requireConsoleAdmin();
  const id = str(fd, "id");
  const t = await getTenantById(id);
  if (!t) go("/console", "Bureau not found", "error");
  try {
    const file = await takeTenantBackup(t!, "manual");
    go(`/console/tenants/${id}#backups`, `Backup created: ${file}`);
  } catch (e) {
    if (isRedirect(e)) throw e;
    go(`/console/tenants/${id}#backups`, `Backup failed: ${errMsg(e)}`, "error");
  }
}

export async function restoreTenantAction(fd: FormData) {
  await requireConsoleAdmin();
  const id = str(fd, "id");
  const t = await getTenantById(id);
  if (!t) go("/console", "Bureau not found", "error");
  if (str(fd, "confirm") !== "RESTORE") go(`/console/tenants/${id}#backups`, "Type RESTORE to confirm", "error");
  try {
    const safety = await restoreTenantBackup(t!, str(fd, "file"));
    go(`/console/tenants/${id}#backups`, `Restored. The data from just before is kept as ${safety}`);
  } catch (e) {
    if (isRedirect(e)) throw e;
    go(`/console/tenants/${id}#backups`, `Restore failed: ${errMsg(e)}`, "error");
  }
}

export async function fullBackupNow() {
  await requireConsoleAdmin();
  try {
    await takeFullBackup();
    go("/console/backups", "Full backup created");
  } catch (e) {
    if (isRedirect(e)) throw e;
    go("/console/backups", `Backup failed: ${errMsg(e)}`, "error");
  }
}

function isRedirect(e: unknown) {
  return typeof e === "object" && e !== null && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT");
}

// ───────────── settings ─────────────

export async function savePlatformEmail(fd: FormData) {
  await requireConsoleAdmin();
  const current = await platform.platformSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  const cfg = readEmailConfig(current.emailConfig);
  const user = str(fd, "user").toLowerCase();
  if (user && !/^\S+@\S+\.\S+$/.test(user)) go("/console/settings", "Enter a valid email address", "error");
  const password = str(fd, "password").replace(/\s+/g, "");
  const next = {
    enabled: fd.get("enabled") === "on",
    user,
    fromName: str(fd, "fromName"),
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    passwordSealed: password ? seal(password) : cfg.passwordSealed,
  };
  if (next.enabled && (!next.user || !next.passwordSealed)) go("/console/settings", "Enter the Gmail address and App Password to turn email on", "error");
  const summary = summaryOptionsSchema.parse({ enabled: fd.get("summaryEnabled") === "on", time: str(fd, "summaryTime"), extraRecipients: [] });
  await platform.platformSettings.update({ where: { id: 1 }, data: { emailConfig: next, summary } });
  revalidatePath("/console/settings");
  go("/console/settings", "Email settings saved");
}

export async function sendPlatformTestEmail() {
  const admin = await requireConsoleAdmin();
  const r = await sendPlatformEmail({ to: admin.email, subject: "Test email from the bureau platform", text: await buildPlatformSummary() });
  go("/console/settings", r.ok ? `Test email (with today's billing summary) sent to ${admin.email}` : `Not sent: ${r.error}`, r.ok ? "ok" : "error");
}

export async function changeConsolePassword(fd: FormData) {
  const me = await requireConsoleAdmin();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("password") ?? "");
  const a = await platform.superAdmin.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await bcrypt.compare(current, a.passwordHash))) go("/console/settings", "The current password is wrong", "error");
  if (next.length < 10) go("/console/settings", "Use at least 10 characters for the new password", "error");
  const updated = await platform.superAdmin.update({
    where: { id: me.id },
    data: { passwordHash: await bcrypt.hash(next, 10), tokenVersion: { increment: 1 } },
  });
  await setConsoleCookie(updated);
  go("/console/settings", "Password changed. Other sessions were signed out.");
}

export async function addSuperAdmin(fd: FormData) {
  await requireConsoleAdmin();
  const email = str(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email)) go("/console/settings", "Enter an email address", "error");
  if (password.length < 10) go("/console/settings", "Use at least 10 characters for the password", "error");
  if (await platform.superAdmin.findUnique({ where: { email } })) go("/console/settings", "That email already has a login", "error");
  await platform.superAdmin.create({ data: { name: str(fd, "name") || email, email, passwordHash: await bcrypt.hash(password, 10) } });
  go("/console/settings", `Super admin ${email} added`);
}

export async function setSuperAdminActive(fd: FormData) {
  const me = await requireConsoleAdmin();
  const id = str(fd, "adminId");
  if (id === me.id) go("/console/settings", "You can't deactivate yourself", "error");
  const active = str(fd, "active") === "1";
  await platform.superAdmin.update({ where: { id }, data: { active, tokenVersion: { increment: 1 } } });
  go("/console/settings", active ? "Login re-activated" : "Login deactivated");
}

export async function saveWhatsAppAutoUpdate(fd: FormData) {
  await requireConsoleAdmin();
  const current = await readPlatformWhatsAppOptions();
  const hour = str(fd, "hour") || "03";
  const autoUpdate = fd.get("autoUpdate") === "on";
  await savePlatformWhatsAppOptions({
    autoUpdate,
    hour: /^\d{2}$/.test(hour) && Number(hour) < 24 ? `${hour}:00` : current.hour,
    // turning auto-update on again gives a previously failed version another chance
    ...(autoUpdate && !current.autoUpdate ? { skipVersion: null } : {}),
  });
  revalidatePath("/console/updates");
  go("/console/updates", autoUpdate ? "Automatic WhatsApp library updates on" : "Automatic updates off");
}

// ───────────── demo data ─────────────

export async function tenantDemoData(fd: FormData) {
  await requireConsoleAdmin();
  const id = str(fd, "id");
  const t = await getTenantById(id);
  if (!t) go("/console", "Bureau not found", "error");
  const path = `/console/tenants/${id}`;
  if (str(fd, "op") === "delete") {
    const r = await runAsTenant(t!, () => deleteDemoForCurrentBureau());
    revalidatePath(path);
    go(path, `Demo data deleted (${r.profiles} profiles, ${r.leads} leads, ${r.payments} receipts)`);
  }
  try {
    const r = await runAsTenant(t!, () => loadDemoForCurrentBureau());
    revalidatePath(path);
    go(path, `Demo data added (${r.profiles} profiles, ${r.leads} leads, ${r.proposals} proposals)`);
  } catch (e) {
    if (isRedirect(e)) throw e;
    go(path, e instanceof DemoDataError ? e.message : `Demo data not added: ${errMsg(e)}`, "error");
  }
}
