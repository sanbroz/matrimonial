import { requireOwner } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { readEmailConfig, readSummaryOptions } from "@/lib/email-config";
import { formatDateTime } from "@/lib/format";
import { Badge, Card, Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { saveEmailSettings, sendSummaryNow, sendTestEmail } from "./actions";
import { Flash } from "../flash";

export const metadata = { title: "Email settings" };

export default async function EmailSettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await requireOwner();
  const sp = await searchParams;
  const [s, recent] = await Promise.all([
    prisma.settings.findUniqueOrThrow({ where: { id: 1 }, select: { emailConfig: true, summaryOptions: true, lastSummaryDate: true } }),
    prisma.outboundMessage.findMany({ where: { channel: "EMAIL" }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const cfg = readEmailConfig(s.emailConfig);
  const summary = readSummaryOptions(s.summaryOptions);
  const advanced = cfg.host !== "smtp.gmail.com" || cfg.port !== 465;
  const ready = cfg.enabled && !!cfg.user && !!cfg.passwordSealed;

  return (
    <div className="space-y-5">
      <Flash {...sp} />
      <form action={saveEmailSettings} className="space-y-5">
        <Card title={<span className="flex items-center gap-2">Gmail account {ready ? <Badge tone="green">On</Badge> : <Badge>Off</Badge>}</span>}>
          <div className="mb-4 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700">
            <p className="font-medium">How to get a Gmail App Password (one time):</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5">
              <li>Sign in to the bureau&apos;s Gmail and turn on <strong>2-Step Verification</strong> (Google Account → Security).</li>
              <li>Open <strong>myaccount.google.com/apppasswords</strong>, create one named &quot;Bureau CRM&quot;.</li>
              <li>Copy the 16-letter password Google shows and paste it below. Your normal Gmail password is never used.</li>
            </ol>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Gmail address">
              <input name="user" type="email" defaultValue={cfg.user} placeholder="yourbureau@gmail.com" className={inputClass} />
            </Field>
            <Field label="App Password" hint={cfg.passwordSealed ? "Saved (encrypted). Leave blank to keep it." : "16 letters, spaces are fine"}>
              <input name="password" type="password" autoComplete="new-password" placeholder={cfg.passwordSealed ? "••••••••••••••••" : ""} className={inputClass} />
            </Field>
            <Field label="Sender name" hint="Shown as the email's sender">
              <input name="fromName" defaultValue={cfg.fromName} placeholder="Bureau name" className={inputClass} />
            </Field>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" name="enabled" defaultChecked={cfg.enabled} className="size-4 accent-brand-600" /> Send emails from the app
          </label>
          <details className="mt-3 text-sm" open={advanced}>
            <summary className="cursor-pointer text-zinc-600">Advanced: a different mail server</summary>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
              <label className="flex items-center gap-2 sm:col-span-4">
                <input type="checkbox" name="advanced" defaultChecked={advanced} className="size-4 accent-brand-600" /> Use these settings instead of Gmail
              </label>
              <Field label="SMTP server"><input name="host" defaultValue={cfg.host} className={inputClass} /></Field>
              <Field label="Port"><input name="port" type="number" defaultValue={cfg.port} className={inputClass} /></Field>
              <label className="flex items-end gap-2 pb-2"><input type="checkbox" name="secure" defaultChecked={cfg.secure} className="size-4 accent-brand-600" /> SSL/TLS</label>
              {cfg.passwordSealed && <label className="flex items-end gap-2 pb-2"><input type="checkbox" name="clearPassword" className="size-4" /> Remove saved password</label>}
            </div>
          </details>
        </Card>

        <Card title="Daily summary email">
          <p className="mb-3 text-sm text-zinc-600">
            Every morning: today&apos;s follow-ups and meetings, proposals needing a call, outstanding dues, memberships to renew
            and yesterday&apos;s collection. Sent to all owners{summary.extraRecipients.length ? " and the extra addresses below" : ""}.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="summaryEnabled" defaultChecked={summary.enabled} className="size-4 accent-brand-600" /> Send the daily summary
            </label>
            <Field label="Time (India)"><input type="time" name="summaryTime" defaultValue={summary.time} className={inputClass} /></Field>
            <Field label="Also send to" hint="Optional, comma separated"><input name="summaryExtra" defaultValue={summary.extraRecipients.join(", ")} className={inputClass} /></Field>
          </div>
          {s.lastSummaryDate && <p className="mt-2 text-xs text-zinc-500">Last sent: {s.lastSummaryDate}</p>}
        </Card>
        <SubmitButton>Save email settings</SubmitButton>
      </form>

      <Card title="Try it">
        <div className="flex flex-wrap items-end gap-3">
          <form action={sendTestEmail} className="flex flex-wrap items-end gap-2">
            <Field label="Send a test email to"><input name="to" type="email" required defaultValue={me.email} className={inputClass + " w-64!"} /></Field>
            <SubmitButton variant="secondary" pendingText="Sending…">Send test</SubmitButton>
          </form>
          <form action={sendSummaryNow}>
            <SubmitButton variant="secondary" pendingText="Sending…">Send today&apos;s summary now</SubmitButton>
          </form>
        </div>
      </Card>

      <Card title="Recent emails">
        {recent.length === 0 ? (
          <p className="text-sm text-zinc-500">None yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 text-sm">
            {recent.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
                <span className="w-40 shrink-0 text-xs text-zinc-500">{formatDateTime(m.createdAt)}</span>
                <span className="min-w-0 flex-1 truncate">{m.subject} → {m.to}</span>
                {m.status === "SENT" ? <Badge tone="green">Sent</Badge> : <Badge tone="red">Failed</Badge>}
                {m.error && <span className="w-full text-xs text-red-600">{m.error}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
