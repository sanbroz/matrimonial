import "server-only";
import { prisma } from "@/lib/db";

/** How this bureau works (Settings → Bureau & fees → How you work). */
export async function workflowSettings() {
  const s = await prisma.settings.findUnique({ where: { id: 1 }, select: { trackMeetings: true } });
  return { trackMeetings: s?.trackMeetings ?? true };
}

/** Profile fields this bureau switched off (Settings → Fields). */
export async function hiddenProfileFields(): Promise<string[]> {
  const s = await prisma.settings.findUnique({ where: { id: 1 }, select: { hiddenFields: true } });
  return s?.hiddenFields ?? [];
}
