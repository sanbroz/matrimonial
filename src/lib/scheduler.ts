/**
 * In-process scheduler (the app runs as one server). Every minute:
 *  - each bureau's daily summary (if due), run as that bureau
 *  - the platform jobs: billing (auto-suspend, super admin summary) and WhatsApp library auto-update
 * Started from instrumentation.ts.
 */
const g = globalThis as unknown as { __schedulerStarted?: boolean };

export function startScheduler() {
  if (g.__schedulerStarted || process.env.DISABLE_SCHEDULER === "1") return;
  g.__schedulerStarted = true;
  let running = false;
  const tick = async () => {
    if (running) return; // a slow tick never overlaps the next one
    running = true;
    try {
      await bureauJobs();
      await platformJobs();
    } finally {
      running = false;
    }
  };
  setTimeout(tick, 30_000);
  setInterval(tick, 60_000);
  console.log("[scheduler] started");
}

async function bureauJobs() {
  let tenants;
  try {
    const { listTenants } = await import("./tenant/registry");
    tenants = await listTenants();
  } catch (e) {
    console.error("[scheduler] could not list bureaus", e);
    return;
  }
  const { runAsTenant } = await import("./tenant/context");
  const { sendDailySummary } = await import("./services/summary");
  for (const t of tenants) {
    try {
      const r = await runAsTenant(t, () => sendDailySummary());
      if (r.sent) console.log(`[scheduler] ${t.slug}: daily summary sent to ${r.recipients.join(", ")}`);
    } catch (e) {
      console.error(`[scheduler] ${t.slug}: daily summary failed`, e);
    }
  }
}

async function platformJobs() {
  try {
    const { billingTick } = await import("./services/billing");
    await billingTick();
  } catch (e) {
    console.error("[scheduler] billing check failed", e);
  }
  try {
    const { autoUpdateTick } = await import("./services/wa-library");
    await autoUpdateTick();
  } catch (e) {
    console.error("[scheduler] WhatsApp auto-update check failed", e);
  }
}
