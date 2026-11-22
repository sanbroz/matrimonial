import { platform } from "@/lib/platform-db";
import { requireConsoleAdmin } from "@/lib/auth/server";
import { readEmailConfig, readSummaryOptions } from "@/lib/email-config";
import { Badge, Card, Field, PageHeader, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { Flash } from "@/app/(staff)/settings/flash";
import { addSuperAdmin, changeConsolePassword, saveFavicon, savePlatformEmail, sendPlatformTestEmail, setSuperAdminActive } from "../../actions";

export const metadata = { title: "Settings" };

export default async function ConsoleSettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await requireConsoleAdmin();
  const sp = await searchParams;
  const [s, admins] = await Promise.all([
    platform.platformSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
    platform.superAdmin.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  const cfg = readEmailConfig(s.emailConfig);
  const summary = readSummaryOptions(s.summary);

  return (
    <>
      <PageHeader title="Settings" />
      <Flash {...sp} />
      <div className="space-y-5">
        <Card title="Platform email (Gmail)">
          <p className="mb-3 text-sm text-zinc-600">
            Used for your own emails: the daily billing summary, automatic suspensions and WhatsApp update results. Each bureau sets
            up its own Gmail in its own settings.
          </p>
          <form key={s.updatedAt.toISOString()} action={savePlatformEmail} className="grid max-w-2xl gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="enabled" defaultChecked={cfg.enabled} className="size-4 accent-brand-600" /> Send email
            </label>
            <Field label="Gmail address"><input name="user" type="email" defaultValue={cfg.user} className={inputClass} /></Field>
            <Field label="App Password" hint={cfg.passwordSealed ? "Saved. Leave empty to keep it." : "Google Account → Security → App passwords"}>
              <input name="password" type="password" autoComplete="new-password" className={inputClass} />
            </Field>
            <Field label="Sender name"><input name="fromName" defaultValue={cfg.fromName} placeholder="Bureau platform" className={inputClass} /></Field>
            <div className="flex flex-wrap items-center gap-2 text-sm sm:col-span-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="summaryEnabled" defaultChecked={summary.enabled} className="size-4 accent-brand-600" />
                Daily billing summary to super admins at
              </label>
              <input name="summaryTime" type="time" defaultValue={summary.time} className={inputClass + " w-32!"} aria-label="Summary time" />
              <span className="text-zinc-500">(India time)</span>
            </div>
            <div className="sm:col-span-2"><SubmitButton>Save</SubmitButton></div>
          </form>
          <form action={sendPlatformTestEmail} className="mt-3 border-t border-zinc-100 pt-3">
            <SubmitButton variant="secondary" pendingText="Sending…">Send me a test email</SubmitButton>
          </form>
        </Card>

        <Card title="Favicon (browser-tab icon)">
          <p className="mb-3 text-sm text-zinc-600">
            Shown in the browser tab and bookmarks for the console and every bureau. A square PNG of 64×64 or 180×180 pixels works
            best; ICO, JPG and WebP are fine too (up to 256 KB).
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.faviconType ? `/api/favicon?v=${s.updatedAt.getTime()}` : "/favicon.ico"} alt="" className="size-8 rounded" />
              <span className="text-zinc-600">{s.faviconType ? "Your icon" : "Standard icon"}</span>
            </div>
            <form action={saveFavicon} className="flex flex-wrap items-center gap-2">
              <input name="favicon" type="file" required accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/jpeg,image/webp" className="text-sm" aria-label="Favicon image" />
              <SubmitButton variant="secondary" pendingText="Uploading…">Upload</SubmitButton>
            </form>
            {s.faviconType && (
              <form action={saveFavicon}>
                <input type="hidden" name="remove" value="1" />
                <SubmitButton variant="ghost" pendingText="…">Use the standard icon</SubmitButton>
              </form>
            )}
          </div>
        </Card>

        <Card title="Super admins">
          <ul className="mb-4 divide-y divide-zinc-100 text-sm">
            {admins.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="font-medium">{a.name}</span>
                <span className="text-zinc-500">{a.email}</span>
                {!a.active && <Badge tone="red">deactivated</Badge>}
                {a.id === me.id ? (
                  <span className="ml-auto text-xs text-zinc-400">you</span>
                ) : (
                  <form action={setSuperAdminActive} className="ml-auto">
                    <input type="hidden" name="adminId" value={a.id} />
                    <input type="hidden" name="active" value={a.active ? "0" : "1"} />
                    <SubmitButton variant="ghost" pendingText="…">{a.active ? "Deactivate" : "Re-activate"}</SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
          <form action={addSuperAdmin} className="grid max-w-2xl gap-3 border-t border-zinc-100 pt-3 sm:grid-cols-3">
            <Field label="Name"><input name="name" className={inputClass} /></Field>
            <Field label="Email"><input name="email" type="email" required className={inputClass} /></Field>
            <Field label="Password" hint="10+ characters"><input name="password" type="text" required minLength={10} autoComplete="off" className={inputClass} /></Field>
            <div><SubmitButton variant="secondary">Add super admin</SubmitButton></div>
          </form>
        </Card>

        <Card title="Your password">
          <form action={changeConsolePassword} className="grid max-w-2xl gap-3 sm:grid-cols-2">
            <Field label="Current password"><input name="current" type="password" required autoComplete="current-password" className={inputClass} /></Field>
            <Field label="New password" hint="10+ characters"><input name="password" type="password" required minLength={10} autoComplete="new-password" className={inputClass} /></Field>
            <div><SubmitButton variant="secondary">Change password</SubmitButton></div>
          </form>
        </Card>
      </div>
    </>
  );
}
