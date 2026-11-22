import { requireOwner } from "@/lib/auth/server";
import { requireTenant } from "@/lib/tenant/context";
import { backupsConfigured, BACKUPS_UNAVAILABLE, formatSize, listTenantBackups, type BackupFile } from "@/lib/backups";
import { Alert, Card } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { BackupList } from "@/components/backup-list";
import { Flash } from "../flash";
import { backupNow, restoreBackup } from "./actions";

export const metadata = { title: "Backups" };

export default async function BackupsSettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireOwner();
  const tenant = await requireTenant();
  const sp = await searchParams;
  let files: BackupFile[] = [];
  let error: string | null = null;
  if (backupsConfigured) {
    try {
      files = await listTenantBackups(tenant.slug);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
  return (
    <div className="space-y-5">
      <Flash {...sp} />
      <Card title="Backups of your data">
        {!backupsConfigured ? (
          <p className="text-sm text-zinc-500">{BACKUPS_UNAVAILABLE}</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-zinc-600">
              Your profiles, leads, payments, settings, photos and files are backed up automatically every night, encrypted and kept
              on the server. You can also back up now, download a copy to keep yourself, or go back to an earlier backup.
            </p>
            {error && <div className="mb-3"><Alert>{error}</Alert></div>}
            <form action={backupNow} className="mb-4">
              <SubmitButton variant="secondary" pendingText="Backing up…">Back up now</SubmitButton>
            </form>
            <BackupList
              files={files.map((b) => ({ ...b, sizeLabel: formatSize(b.size) }))}
              restoreAction={restoreBackup}
              downloadUrl="/api/backups/download"
            />
            <p className="mt-4 text-xs text-zinc-500">
              Restoring replaces everything in this CRM with the backup (for all staff). A backup of the current data is taken first,
              so a restore can be undone by restoring that one.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
