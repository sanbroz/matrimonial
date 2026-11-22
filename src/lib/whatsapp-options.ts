import { z } from "zod";

/** Settings.whatsappOptions */
export const whatsappOptionsSchema = z.object({
  /** Install new WhatsApp library (Baileys) releases automatically */
  autoUpdate: z.boolean().catch(false),
  /** Hour (India time) for automatic updates, "HH:00" */
  hour: z.string().regex(/^\d{2}:00$/).catch("03:00"),
  /** Last automatic attempt (one per day) */
  lastAuto: z
    .object({ date: z.string(), version: z.string(), result: z.enum(["started", "success", "failed"]), notified: z.boolean() })
    .nullable()
    .catch(null),
  /** A version that failed automatically is not tried again automatically */
  skipVersion: z.string().nullable().catch(null),
});
export type WhatsAppOptions = z.infer<typeof whatsappOptionsSchema>;
export const readWhatsAppOptions = (json: unknown): WhatsAppOptions => whatsappOptionsSchema.parse(json ?? {});

/** Should an automatic update start now? Pure (unit-tested). */
export function shouldAutoUpdate(
  opts: WhatsAppOptions,
  lib: { latest: string | null; updateAvailable: boolean } | null | undefined,
  now: { date: string; time: string },
  busy: boolean,
): boolean {
  if (!opts.autoUpdate || busy || !lib?.updateAvailable || !lib.latest) return false;
  if (opts.skipVersion === lib.latest) return false;
  if (opts.lastAuto?.date === now.date) return false; // at most one try per day
  const hour = opts.hour.slice(0, 2);
  return now.time.slice(0, 2) === hour; // only within the chosen hour
}
