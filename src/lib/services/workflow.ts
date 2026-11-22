import "server-only";
import { prisma } from "@/lib/db";

/** How this bureau works (Settings → Bureau & fees → How you work). */
export async function workflowSettings() {
  const s = await prisma.settings.findUnique({ where: { id: 1 }, select: { trackMeetings: true } });
  return { trackMeetings: s?.trackMeetings ?? true };
}
