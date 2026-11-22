import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { FEATURES, readFeatures, type Feature, type Features } from "@/lib/features";

/** Profile fields that belong to the horoscope feature (hidden when it is off). */
const HOROSCOPE_FIELDS = ["birthTime", "birthPlace", "manglik", "rashi", "nakshatra", "pref.manglik"];

/** How this bureau works: its feature switches and whether it tracks meetings. */
export async function bureauFeatures(): Promise<Features & { trackMeetings: boolean }> {
  const s = await prisma.settings.findUnique({ where: { id: 1 }, select: { features: true, trackMeetings: true } });
  return { ...readFeatures(s?.features), trackMeetings: s?.trackMeetings ?? true };
}

/** For pages of a module the bureau switched off: back to the dashboard with a note. */
export async function requireFeature(f: Feature) {
  const features = await bureauFeatures();
  if (!features[f]) redirect(`/?off=${encodeURIComponent(FEATURES[f].label)}`);
  return features;
}

/** Kept for existing callers: meetings on/off. */
export async function workflowSettings() {
  const f = await bureauFeatures();
  return { trackMeetings: f.trackMeetings && f.pipeline };
}

/** Profile fields this bureau doesn't use (Settings → Fields, plus horoscope fields when that feature is off). */
export async function hiddenProfileFields(): Promise<string[]> {
  const s = await prisma.settings.findUnique({ where: { id: 1 }, select: { hiddenFields: true, features: true } });
  const hidden = s?.hiddenFields ?? [];
  return readFeatures(s?.features).horoscope ? hidden : [...new Set([...hidden, ...HOROSCOPE_FIELDS])];
}
