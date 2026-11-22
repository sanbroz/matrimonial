import "server-only";
import { prisma } from "@/lib/db";
import { getBaileysRun, startBaileysUpdate } from "@/lib/updater";
import { readWhatsAppOptions, shouldAutoUpdate } from "@/lib/whatsapp-options";
import { getWhatsAppStatus } from "./whatsapp";
import { isEmailConfigured, sendEmail } from "./email";
import { istNow } from "./summary";

async function saveOptions(patch: Record<string, unknown>) {
  const s = await prisma.settings.findUniqueOrThrow({ where: { id: 1 }, select: { whatsappOptions: true } });
  await prisma.settings.update({ where: { id: 1 }, data: { whatsappOptions: { ...readWhatsAppOptions(s.whatsappOptions), ...patch } } });
}

/**
 * Scheduler tick: (1) record the result of an automatic update and tell the owners by email,
 * (2) start a new automatic update if one is due.
 */
export async function autoUpdateTick(now = new Date()) {
  const s = await prisma.settings.findUniqueOrThrow({ where: { id: 1 }, select: { whatsappOptions: true, bureauName: true } });
  const opts = readWhatsAppOptions(s.whatsappOptions);
  const updater = await getBaileysRun();
  if (!updater) return; // no updater (development) → nothing to do

  // (1) Follow up on the last automatic attempt
  const last = opts.lastAuto;
  if (last && last.result === "started" && updater.run.target === last.version && ["success", "failed"].includes(updater.run.status)) {
    const ok = updater.run.status === "success";
    await saveOptions({
      lastAuto: { ...last, result: ok ? "success" : "failed", notified: true },
      ...(ok ? {} : { skipVersion: last.version }),
    });
    if (await isEmailConfigured()) {
      const owners = await prisma.user.findMany({ where: { role: "OWNER", active: true }, select: { email: true } });
      for (const o of owners) {
        await sendEmail({
          to: o.email,
          subject: ok
            ? `${s.bureauName}: WhatsApp updated to ${last.version}`
            : `${s.bureauName}: automatic WhatsApp update to ${last.version} failed`,
          text:
            (updater.run.message ?? "") +
            (ok
              ? "\n\nNothing to do. WhatsApp keeps working with the linked number."
              : "\n\nThe previous version is back in use. This version won't be tried automatically again; you can retry it in Settings → WhatsApp."),
          kind: "whatsapp_update",
        });
      }
    }
    return;
  }

  // (2) Start one if due
  const wa = await getWhatsAppStatus();
  if (shouldAutoUpdate(opts, wa.library, istNow(now), !!updater.busy)) {
    const target = wa.library!.latest!;
    const r = await startBaileysUpdate(target);
    await saveOptions({ lastAuto: { date: istNow(now).date, version: target, result: r.ok ? "started" : "failed", notified: !r.ok } });
    console.log(`[scheduler] automatic WhatsApp library update to ${target}: ${r.ok ? "started" : r.error}`);
  }
}
