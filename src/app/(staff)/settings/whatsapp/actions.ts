"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/server";
import { logoutWhatsApp, sendWhatsApp, startWhatsAppLink } from "@/lib/services/whatsapp";

export async function unlinkWhatsApp() {
  await requireOwner();
  await logoutWhatsApp();
  revalidatePath("/settings/whatsapp");
  redirect(`/settings/whatsapp?ok=${encodeURIComponent("Number unlinked. Click \"Link a WhatsApp number\" to link one again.")}`);
}

export async function linkWhatsApp() {
  await requireOwner();
  await startWhatsAppLink();
  revalidatePath("/settings/whatsapp");
  redirect("/settings/whatsapp");
}

export async function sendTestWhatsApp(fd: FormData) {
  const user = await requireOwner();
  const phone = String(fd.get("phone") ?? "").trim();
  const r = await sendWhatsApp({ phone, text: "Test message from Bureau CRM ✅", kind: "test", userId: user.id });
  redirect(`/settings/whatsapp?${r.ok ? "ok" : "error"}=${encodeURIComponent(r.ok ? `Test message sent to ${phone}` : `Not sent: ${r.error}`)}`);
}
