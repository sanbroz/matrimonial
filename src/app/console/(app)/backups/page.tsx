import { requireConsoleAdmin } from "@/lib/auth/server";
import Link from "next/link";
import { platform } from "@/lib/platform-db";
import { backupsConfigured, BACKUPS_UNAVAILABLE, formatSize, listFullBackups, listTenantBackups, type BackupFile } from "@/lib/backups";
import { Alert, Card, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { Flash } from "@/app/(staff)/settings/flash";
import { fullBackupNow } from "../../actions";

export const metadata = { title: "Backups" };

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default async function BackupsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireConsoleAdmin(); // layouts don't re-run on client navigation
  const sp = await searchParams;
  const tenants = await platform.tenant.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, slug: true, name: true } });
  let full: BackupFile[] = [];
  const latest = new Map<string, BackupFile | null>();
  let error: string | null = null;
  if (backupsConfigured) {
    try {
      full = await listFullBackups();
      const lists = await Promise.all(tenants.map((t) => listTenantBackups(t.slug).catch(() => [])));
      tenants.forEach((t, i) => latest.set(t.id, lists[i][0] ?? null));
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
  const stale = (b: BackupFile | null | undefined) => !b || Date.now() - new Date(b.created).getTime() > 36 * 3600_000;

  return (
    <>
      <PageHeader title="Backups" />
      <Flash {...sp} />
      {!backupsConfigured ? (
        <Alert tone="amber">{BACKUPS_UNAVAILABLE}</Alert>
      ) : (
        <div className="space-y-5">
          {error && <Alert>{error}</Alert>}
          <Card title="Whole server">
            <p className="mb-3 text-sm text-zinc-600">
              Every night: one encrypted file with all bureaus and the platform. To restore the whole server (disaster recovery) run
              <code className="mx-1 rounded bg-zinc-100 px-1">./ops/restore.sh FILE</code>on the server; it stops the app first.
            </p>
            <form action={fullBackupNow} className="mb-3">
              <SubmitButton variant="secondary" pendingText="Backing up…">Back up the whole server now</SubmitButton>
            </form>
            {full.length === 0 ? (
              <p className="text-sm text-zinc-500">No full backups yet.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 text-sm">
                {full.slice(0, 15).map((b) => (
                  <li key={b.file} className="flex flex-wrap gap-x-3 py-1.5">
                    <span className="font-medium">{fmt(b.created)}</span>
                    <span className="font-mono text-xs text-zinc-500">{b.file}</span>
                    <span className="ml-auto text-xs text-zinc-500">{formatSize(b.size)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Each bureau">
            <p className="mb-3 text-sm text-zinc-600">Separate nightly backups per bureau, so one bureau can be restored without touching the others.</p>
            <ul className="divide-y divide-zinc-100 text-sm">
              {tenants.map((t) => {
                const b = latest.get(t.id);
                return (
                  <li key={t.id} className="flex flex-wrap items-center gap-x-3 py-2">
                    <Link href={`/console/tenants/${t.id}#backups`} className="font-medium hover:text-brand-700">{t.name}</Link>
                    <span className={stale(b) ? "text-xs text-red-600" : "text-xs text-zinc-500"}>
                      {b ? `last backup ${fmt(b.created)} (${formatSize(b.size)})` : "no backup yet"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
