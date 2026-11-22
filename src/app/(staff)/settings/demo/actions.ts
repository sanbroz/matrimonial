"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/server";
import { DemoDataError } from "@/lib/demo-data";
import { deleteDemoForCurrentBureau, loadDemoForCurrentBureau } from "@/lib/services/demo";

const back = (msg: string, key: "ok" | "error" = "ok"): never => redirect(`/settings/demo?${key}=${encodeURIComponent(msg)}`);

export async function loadDemo() {
  await requireOwner();
  let r;
  try {
    r = await loadDemoForCurrentBureau();
  } catch (e) {
    if (e instanceof DemoDataError) back(e.message, "error");
    throw e;
  }
  revalidatePath("/", "layout");
  back(`Added ${r.profiles} demo profiles, ${r.leads} leads, ${r.proposals} proposals and ${r.receipts} receipts`);
}

export async function deleteDemo(fd: FormData) {
  await requireOwner();
  if (String(fd.get("confirm") ?? "").trim().toUpperCase() !== "DELETE DEMO") back("Type DELETE DEMO to confirm", "error");
  const r = await deleteDemoForCurrentBureau();
  revalidatePath("/", "layout");
  back(
    `Demo data deleted (${r.profiles} profiles, ${r.leads} leads, ${r.payments} receipts).` +
      (r.numberingReset ? " Profile codes and receipt numbers start from the beginning again." : "") +
      " You're ready to add your real clients.",
  );
}
