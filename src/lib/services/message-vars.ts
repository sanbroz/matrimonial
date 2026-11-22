import "server-only";
import { prisma } from "@/lib/db";
import { readTemplates, type Templates } from "@/lib/templates";

/** Template + common placeholders for building default message texts on pages. */
export async function messageContext(): Promise<{ templates: Templates; base: { bureau: string; bureau_phone: string | null } }> {
  const s = await prisma.settings.findUniqueOrThrow({
    where: { id: 1 },
    select: { bureauName: true, phone: true, whatsapp: true, messageTemplates: true },
  });
  return { templates: readTemplates(s.messageTemplates), base: { bureau: s.bureauName, bureau_phone: s.whatsapp || s.phone } };
}

/** How to address a family: the contact person if recorded, else the candidate. */
export const addressee = (p: { contactName: string | null; fullName: string }) => p.contactName || p.fullName;
