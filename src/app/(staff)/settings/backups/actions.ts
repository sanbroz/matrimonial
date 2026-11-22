"use server";

import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/server";
import { requireTenant } from "@/lib/tenant/context";
import { restoreTenantBackup, takeTenantBackup } from "@/lib/backups";

const back = (msg: string, key: "ok" | "error" = "ok"): never => redirect(`/settings/backups?${key}=${encodeURIComponent(msg)}`);
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function backupNow() {
  await requireOwner();
  const t = await requireTenant();
  let file: string;
  try {
    file = await takeTenantBackup(t, "manual");
  } catch (e) {
    back(`Backup failed: ${errMsg(e)}`, "error");
  }
  back(`Backup created (${file!})`);
}

export async function restoreBackup(fd: FormData) {
  const user = await requireOwner();
  const t = await requireTenant();
  if (String(fd.get("confirm") ?? "").trim() !== "RESTORE") back("Type RESTORE to confirm", "error");
  const file = String(fd.get("file") ?? "");
  try {
    await restoreTenantBackup(t, file);
  } catch (e) {
    back(`Restore failed, nothing was changed: ${errMsg(e)}`, "error");
  }
  console.log(`[backups] ${t.slug}: restored ${file} by ${user.email}`);
  // Logins may have changed with the restored data
  redirect("/login");
}
