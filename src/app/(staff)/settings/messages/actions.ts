"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/auth/server";
import { DEFAULT_TEMPLATES, TEMPLATE_KEYS, type TemplateKey } from "@/lib/templates";

export async function saveTemplates(fd: FormData) {
  await requireOwner();
  const saved: Partial<Record<TemplateKey, string>> = {};
  for (const k of Object.keys(TEMPLATE_KEYS) as TemplateKey[]) {
    const v = String(fd.get(k) ?? "").replace(/\r\n/g, "\n").trim().slice(0, 2000);
    // Only store real changes; empty = back to default
    if (v && v !== DEFAULT_TEMPLATES[k]) saved[k] = v;
  }
  await prisma.settings.update({ where: { id: 1 }, data: { messageTemplates: saved } });
  revalidatePath("/settings/messages");
  redirect(`/settings/messages?ok=${encodeURIComponent("Templates saved")}`);
}
