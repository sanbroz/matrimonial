import "server-only";
import { platform } from "@/lib/platform-db";
import { getBaileysRun, startBaileysUpdate } from "@/lib/updater";
import { readWhatsAppOptions, shouldAutoUpdate } from "@/lib/whatsapp-options";
import { getWhatsAppLibrary } from "./whatsapp";
import { emailSuperAdmins } from "./platform-email";
import { istNow } from "./summary";

/** WhatsApp library (Baileys) auto-update: platform-wide, set in the super admin console. */
export async function readPlatformWhatsAppOptions() {
  const s = await platform.platformSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 }, select: { whatsappOptions: true } });
  return readWhatsAppOptions(s.whatsappOptions);
}

export async function savePlatformWhatsAppOptions(patch: Record<string, unknown>) {
  const current = await readPlatformWhatsAppOptions();
  await platform.platformSettings.update({ where: { id: 1 }, data: { whatsappOptions: { ...current, ...patch } } });
}

/**
 * Scheduler tick: (1) record the result of an automatic update and tell the super admins by email,
 * (2) start a new automatic update if one is due.
 */
export async function autoUpdateTick(now = new Date()) {
  const updater = await getBaileysRun();
  if (!updater) return; // no updater (development) → nothing to do
  const opts = await readPlatformWhatsAppOptions();

  // (1) Follow up on the last automatic attempt
  const last = opts.lastAuto;
  if (last && last.result === "started" && updater.run.target === last.version && ["success", "failed"].includes(updater.run.status)) {
    const ok = updater.run.status === "success";
    await savePlatformWhatsAppOptions({
      lastAuto: { ...last, result: ok ? "success" : "failed", notified: true },
      ...(ok ? {} : { skipVersion: last.version }),
    });
    await emailSuperAdmins(
      ok ? `WhatsApp library updated to ${last.version}` : `Automatic WhatsApp library update to ${last.version} failed`,
      (updater.run.message ?? "") +
        (ok
          ? "\n\nNothing to do. The bureaus' linked numbers keep working."
          : "\n\nThe previous version is back in use. This version won't be tried automatically again; you can retry it in the console → Updates."),
    );
    return;
  }

  // (2) Start one if due
  const lib = await getWhatsAppLibrary();
  if (shouldAutoUpdate(opts, lib, istNow(now), !!updater.busy)) {
    const target = lib!.latest!;
    const r = await startBaileysUpdate(target);
    await savePlatformWhatsAppOptions({ lastAuto: { date: istNow(now).date, version: target, result: r.ok ? "started" : "failed", notified: !r.ok } });
    console.log(`[scheduler] automatic WhatsApp library update to ${target}: ${r.ok ? "started" : r.error}`);
  }
}
