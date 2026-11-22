/**
 * In-process scheduler (the app runs as one server). Checks every minute whether the
 * daily summary is due. Started from instrumentation.ts.
 */
const g = globalThis as unknown as { __schedulerStarted?: boolean };

export function startScheduler() {
  if (g.__schedulerStarted || process.env.DISABLE_SCHEDULER === "1") return;
  g.__schedulerStarted = true;
  const tick = async () => {
    try {
      const { sendDailySummary } = await import("./services/summary");
      const r = await sendDailySummary();
      if (r.sent) console.log(`[scheduler] daily summary sent to ${r.recipients.join(", ")}`);
    } catch (e) {
      console.error("[scheduler] daily summary failed", e);
    }
  };
  setTimeout(tick, 30_000);
  setInterval(tick, 60_000);
  console.log("[scheduler] started");
}
