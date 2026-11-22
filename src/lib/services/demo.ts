import "server-only";
import { db } from "@/lib/db";
import { deleteDemoData, demoCounts, loadDemoData } from "@/lib/demo-data";
import { deleteUpload } from "@/lib/storage";

/** Demo data for the CURRENT bureau (request host or runAsTenant). */
export async function currentDemoCounts() {
  return demoCounts(await db());
}

export async function loadDemoForCurrentBureau() {
  return loadDemoData(await db());
}

export async function deleteDemoForCurrentBureau() {
  const r = await deleteDemoData(await db());
  for (const key of r.files) await deleteUpload(key);
  return r;
}
