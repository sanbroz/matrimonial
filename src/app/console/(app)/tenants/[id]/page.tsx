import { requireConsoleAdmin } from "@/lib/auth/server";
import { notFound } from "next/navigation";
import { platform } from "@/lib/platform-db";
import { clientForSchema } from "@/lib/db";
import { demoCounts } from "@/lib/demo-data";
import { billingState, CYCLE_LABELS, daysOverdue, type Cycle } from "@/lib/billing";
import { rupees } from "@/lib/money";
import { formatDateOnly, formatDateTime, toDateInput } from "@/lib/format";
import { todayDate } from "@/lib/services/billing";
import { subdomainUrl } from "@/lib/tenant/host";
import { backupsConfigured, BACKUPS_UNAVAILABLE, formatSize, listTenantBackups, type BackupFile } from "@/lib/backups";
import { Alert, Badge, Card, DL, Field, PageHeader, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { Flash } from "@/app/(staff)/settings/flash";
import { BackupList } from "@/components/backup-list";
import {
  addTenantDomain,
  backupTenantNow,
  deleteTenantAction,
  recordTenantPayment,
  restoreTenantAction,
  tenantDemoData,
  setTenantStatus,
  updateTenantDetails,
  updateTenantDomain,
  voidTenantPayment,
} from "../../../actions";

const STATUS_TONE = { ACTIVE: "green", TRIAL: "blue", SUSPENDED: "red" } as const;

export default async function TenantPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireConsoleAdmin(); // layouts don't re-run on client navigation
  const { id } = await params;
  const sp = await searchParams;
  const t = await platform.tenant.findUnique({
    where: { id },
    include: { domains: { orderBy: { createdAt: "asc" } }, payments: { orderBy: { paidAt: "desc" }, take: 24 } },
  });
  if (!t) notFound();
  const db = clientForSchema(t.schema);
  const [staff, profiles, leads, settings] = await Promise.all([
    db.user.count({ where: { active: true } }),
    db.profile.count(),
    db.lead.count(),
    db.settings.findUnique({ where: { id: 1 }, select: { bureauName: true } }),
  ]).catch(() => [null, null, null, null] as const);
  const demo = await demoCounts(db).catch(() => null);
  let backups: BackupFile[] | null = null;
  let backupError: string | null = null;
  if (backupsConfigured) {
    try {
      backups = await listTenantBackups(t.slug);
    } catch (e) {
      backupError = e instanceof Error ? e.message : String(e);
    }
  }
  const today = todayDate();
  const state = billingState(t.nextDueDate, today);
  const url = subdomainUrl(t.slug);

  return (
    <>
      <PageHeader
        title={t.name}
        subtitle={
          <a href={url} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">
            {url.replace(/^https?:\/\//, "")}
          </a>
        }
        actions={<Badge tone={STATUS_TONE[t.status]}>{t.status.toLowerCase()}</Badge>}
      />
      <Flash {...sp} />
      {t.status === "SUSPENDED" && (
        <div className="mb-4">
          <Alert>Suspended{t.suspendedReason ? `: ${t.suspendedReason}` : ""}. Staff see a &quot;service paused&quot; page; their data is kept.</Alert>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Overview">
          <DL
            items={[
              ["Name in the app", settings?.bureauName ?? "—"],
              ["Active staff logins", staff ?? "—"],
              ["Profiles", profiles ?? "—"],
              ["Leads", leads ?? "—"],
              ["Database section", <span key="s" className="font-mono text-xs">{t.schema}</span>],
              ["Created", formatDateTime(t.createdAt)],
            ]}
          />
          <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
            {t.status !== "ACTIVE" && (
              <form action={setTenantStatus}>
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="status" value="ACTIVE" />
                <SubmitButton variant="secondary">{t.status === "SUSPENDED" ? "Resume bureau" : "Mark active"}</SubmitButton>
              </form>
            )}
            {t.status !== "SUSPENDED" && (
              <form action={setTenantStatus} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="status" value="SUSPENDED" />
                <input name="reason" placeholder="Reason (optional)" className={inputClass + " w-48!"} aria-label="Reason for suspending" />
                <SubmitButton variant="danger" confirm={`Suspend ${t.name}? Their staff can't sign in until you resume it.`}>Suspend</SubmitButton>
              </form>
            )}
          </div>
        </Card>

        <Card title="Billing">
          <div className="mb-3 text-sm">
            {t.nextDueDate ? (
              <span className={state === "overdue" ? "font-medium text-red-600" : state === "due_soon" ? "text-amber-700" : "text-zinc-700"}>
                Next payment {rupees(t.fee)} due {formatDateOnly(t.nextDueDate)}
                {state === "overdue" && ` (${daysOverdue(t.nextDueDate, today)} days overdue)`}
              </span>
            ) : (
              <span className="text-zinc-500">No due date set.</span>
            )}
          </div>
          <form action={recordTenantPayment} className="grid gap-3 border-t border-zinc-100 pt-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={t.id} />
            <Field label="Amount (₹)"><input name="amount" type="number" min={1} required defaultValue={t.fee || undefined} className={inputClass} /></Field>
            <Field label="Paid on"><input name="paidAt" type="date" required defaultValue={toDateInput(today)} className={inputClass} /></Field>
            <Field label="Mode">
              <select name="mode" className={inputClass}>
                {["UPI", "Bank transfer", "Cash", "Cheque", "Other"].map((m) => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Covers" hint={`From the current due date, ${CYCLE_LABELS[t.billingCycle as Cycle].toLowerCase()} periods`}>
              <select name="cycles" className={inputClass} defaultValue="1">
                {[1, 2, 3, 4, 6, 12].map((n) => <option key={n} value={n}>{n} period{n > 1 ? "s" : ""}</option>)}
              </select>
            </Field>
            <Field label="Note" className="sm:col-span-2"><input name="note" className={inputClass} /></Field>
            <div className="sm:col-span-2"><SubmitButton variant="secondary">Record payment</SubmitButton></div>
          </form>
          {t.payments.length > 0 && (
            <ul className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100 text-sm">
              {t.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <span className={p.voidedAt ? "text-zinc-400 line-through" : "font-medium"}>{rupees(p.amount)}</span>
                  <span className="text-zinc-600">{formatDateOnly(p.paidAt)} · {p.mode}</span>
                  {p.periodFrom && p.periodTo && <span className="text-xs text-zinc-500">for {formatDateOnly(p.periodFrom)} – {formatDateOnly(p.periodTo)}</span>}
                  {p.note && <span className="w-full text-xs text-zinc-500">{p.note}</span>}
                  {!p.voidedAt && (
                    <form action={voidTenantPayment} className="ml-auto">
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="paymentId" value={p.id} />
                      <SubmitButton variant="ghost" pendingText="…" confirm="Void this payment? The due date is not moved back automatically.">Void</SubmitButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Details and billing plan" className="mt-5">
        <form key={t.updatedAt.toISOString()} action={updateTenantDetails} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <input type="hidden" name="id" value={t.id} />
          <Field label="Bureau name"><input name="name" required defaultValue={t.name} className={inputClass} /></Field>
          <Field label="Contact person"><input name="contactName" defaultValue={t.contactName ?? ""} className={inputClass} /></Field>
          <Field label="Contact phone"><input name="contactPhone" defaultValue={t.contactPhone ?? ""} className={inputClass} /></Field>
          <Field label="Contact email"><input name="contactEmail" type="email" defaultValue={t.contactEmail ?? ""} className={inputClass} /></Field>
          <Field label="Plan name"><input name="planName" defaultValue={t.planName ?? ""} placeholder="e.g. Standard" className={inputClass} /></Field>
          <Field label="Fee per cycle (₹)"><input name="fee" type="number" min={0} defaultValue={t.fee} className={inputClass} /></Field>
          <Field label="Billing cycle">
            <select name="billingCycle" defaultValue={t.billingCycle} className={inputClass}>
              {Object.entries(CYCLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Next due date"><input name="nextDueDate" type="date" defaultValue={toDateInput(t.nextDueDate)} className={inputClass} /></Field>
          <Field label="Suspend automatically" hint="Days after the due date; empty = never">
            <input name="autoSuspendDays" type="number" min={0} max={365} defaultValue={t.autoSuspendDays ?? ""} className={inputClass} />
          </Field>
          <Field label="Notes" className="sm:col-span-2 lg:col-span-3"><textarea name="notes" rows={2} defaultValue={t.notes ?? ""} className={inputClass} /></Field>
          <div><SubmitButton>Save</SubmitButton></div>
        </form>
      </Card>

      <Card title="Domains" className="mt-5">
        <p className="mb-3 text-sm text-zinc-600">
          Always available at <strong>{url.replace(/^https?:\/\//, "")}</strong>. Custom domains (e.g. crm.theirbureau.in) can be recorded
          here; they start working once custom domains are switched on for the platform and the domain is marked active.
        </p>
        {t.domains.length > 0 && (
          <ul className="mb-3 divide-y divide-zinc-100 text-sm">
            {t.domains.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="font-medium">{d.host}</span>
                <Badge tone={d.active ? "green" : "zinc"}>{d.active ? "active" : "inactive"}</Badge>
                {d.primary && <Badge tone="brand">used in emails</Badge>}
                <span className="ml-auto flex gap-1">
                  {(["toggle", ...(d.active && !d.primary ? ["primary"] : []), "delete"] as const).map((op) => (
                    <form key={op} action={updateTenantDomain}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="domainId" value={d.id} />
                      <input type="hidden" name="op" value={op} />
                      <SubmitButton variant={op === "delete" ? "danger" : "ghost"} pendingText="…" confirm={op === "delete" ? `Remove ${d.host}?` : undefined}>
                        {op === "toggle" ? (d.active ? "Deactivate" : "Activate") : op === "primary" ? "Use in emails" : "Remove"}
                      </SubmitButton>
                    </form>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
        <form action={addTenantDomain} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={t.id} />
          <Field label="Custom domain"><input name="host" placeholder="crm.theirbureau.in" className={inputClass + " w-64!"} /></Field>
          <SubmitButton variant="secondary">Add domain</SubmitButton>
        </form>
      </Card>

      <Card title="Backups" className="mt-5" >
        <div id="backups" className="scroll-mt-4" />
        {!backupsConfigured ? (
          <p className="text-sm text-zinc-500">{BACKUPS_UNAVAILABLE}</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-zinc-600">
              A backup of this bureau is taken every night (kept for the configured number of days). Restoring replaces only this
              bureau&apos;s data and files; a copy of the current data is taken first.
            </p>
            {backupError && <div className="mb-3"><Alert>{backupError}</Alert></div>}
            <form action={backupTenantNow} className="mb-3">
              <input type="hidden" name="id" value={t.id} />
              <SubmitButton variant="secondary" pendingText="Backing up…">Back up now</SubmitButton>
            </form>
            <BackupList
              files={(backups ?? []).map((b) => ({ ...b, sizeLabel: formatSize(b.size) }))}
              hidden={{ id: t.id }}
              restoreAction={restoreTenantAction}
              downloadUrl={`/api/console/tenants/${t.id}/backup`}
            />
          </>
        )}
      </Card>

      <Card title="Demo data" className="mt-5">
        {demo?.any ? (
          <form action={tenantDemoData} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="op" value="delete" />
            <span className="text-sm text-zinc-700">Loaded: {demo.profiles} sample profiles, {demo.leads} leads. The owner can also delete it in Settings → Demo data.</span>
            <SubmitButton variant="danger" pendingText="Deleting…" confirm="Delete all demo data in this bureau? Their own records stay.">Delete demo data</SubmitButton>
          </form>
        ) : (
          <form action={tenantDemoData} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="op" value="load" />
            <span className="text-sm text-zinc-700">No demo data. Add 40 Indian / Punjabi sample profiles with leads, proposals and receipts.</span>
            <SubmitButton variant="secondary" pendingText="Adding…">Add demo data</SubmitButton>
          </form>
        )}
      </Card>

      <Card title="Delete bureau" className="mt-5 border-red-200">
        <p className="mb-3 text-sm text-zinc-600">
          Deletes all of this bureau&apos;s data, files and its WhatsApp link for good. A final backup is taken first and kept like the
          other backups.
        </p>
        <form action={deleteTenantAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={t.id} />
          <Field label={`Type "${t.slug}" to confirm`}><input name="confirmSlug" autoComplete="off" className={inputClass + " w-56!"} /></Field>
          <SubmitButton variant="danger" pendingText="Deleting…" confirm={`Delete ${t.name} and all its data?`}>Delete bureau</SubmitButton>
        </form>
      </Card>
    </>
  );
}
