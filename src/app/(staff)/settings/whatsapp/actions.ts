"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/server";
import { logoutWhatsApp, sendWhatsApp } from "@/lib/services/whatsapp";
import { prisma } from "@/lib/db";
import { readWhatsAppOptions } from "@/lib/whatsapp-options";

export async function unlinkWhatsApp() {
  await requireOwner();
  await logoutWhatsApp();
  revalidatePath("/settings/whatsapp");
  redirect(`/settings/whatsapp?ok=${encodeURIComponent("Number unlinked. Scan the new QR code to link a number again.")}`);
}

export async function saveWhatsAppOptions(fd: FormData) {
  await requireOwner();
  const s = await prisma.settings.findUniqueOrThrow({ where: { id: 1 }, select: { whatsappOptions: true } });
  const current = readWhatsAppOptions(s.whatsappOptions);
  const hour = String(fd.get("hour") ?? "03");
  const next = {
    ...current,
    autoUpdate: fd.get("autoUpdate") === "on",
    hour: /^\d{2}$/.test(hour) && Number(hour) < 24 ? `${hour}:00` : current.hour,
    // turning auto-update on again gives a previously failed version another chance
    ...(fd.get("autoUpdate") === "on" && !current.autoUpdate ? { skipVersion: null } : {}),
  };
  await prisma.settings.update({ where: { id: 1 }, data: { whatsappOptions: next } });
  revalidatePath("/settings/whatsapp");
  redirect(`/settings/whatsapp?ok=${encodeURIComponent(next.autoUpdate ? `Automatic updates on, at ${next.hour}` : "Automatic updates off")}`);
}

export async function sendTestWhatsApp(fd: FormData) {
  const user = await requireOwner();
  const phone = String(fd.get("phone") ?? "").trim();
  const r = await sendWhatsApp({ phone, text: "Test message from Bureau CRM ✅", kind: "test", userId: user.id });
  redirect(`/settings/whatsapp?${r.ok ? "ok" : "error"}=${encodeURIComponent(r.ok ? `Test message sent to ${phone}` : `Not sent: ${r.error}`)}`);
}
