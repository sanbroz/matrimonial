import { platform } from "@/lib/platform-db";
import { listWhatsAppSessions } from "@/lib/services/whatsapp";
import { readPlatformWhatsAppOptions } from "@/lib/services/wa-library";
import { appVersion } from "@/lib/version";
import { Badge, Card, PageHeader, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { LibraryCard } from "@/components/wa-library-card";
import { Flash } from "@/app/(staff)/settings/flash";
import { saveWhatsAppAutoUpdate } from "../../actions";

export const metadata = { title: "Updates" };

export default async function UpdatesPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const [opts, sessions, tenants, s] = await Promise.all([
    readPlatformWhatsAppOptions(),
    listWhatsAppSessions(),
    platform.tenant.findMany({ select: { slug: true, name: true } }),
    platform.platformSettings.findUnique({ where: { id: 1 }, select: { updatedAt: true } }),
  ]);
  const names = new Map(tenants.map((t) => [t.slug, t.name]));

  return (
    <>
      <PageHeader title="Updates" subtitle={`App version ${appVersion.version} (${appVersion.commit.slice(0, 7)})`} />
      <Flash {...sp} />
      <div className="space-y-5">
        <Card title="App">
          <p className="text-sm text-zinc-600">
            When a new release is on the server, &quot;Back up &amp; update&quot; appears under Sign out. It updates every bureau at
            once; bureau owners only see the version number.
          </p>
        </Card>

        <Card title="WhatsApp library (Baileys)">
          <p className="mb-3 text-sm text-zinc-600">
            WhatsApp changes its app regularly; new library releases keep every bureau&apos;s linked number working. After an update
            each bureau that was connected must reconnect, or the previous version is restored automatically.
          </p>
          <LibraryCard />
          <form key={s?.updatedAt.toISOString()} action={saveWhatsAppAutoUpdate} className="mt-4 flex flex-wrap items-end gap-3 border-t border-zinc-100 pt-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="autoUpdate" defaultChecked={opts.autoUpdate} className="size-4 accent-brand-600" />
              Install new versions automatically
            </label>
            <label className="flex items-center gap-2">
              at
              <select name="hour" defaultValue={opts.hour.slice(0, 2)} className={inputClass + " w-24! py-1.5!"}>
                {Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0")).map((h) => <option key={h} value={h}>{h}:00</option>)}
              </select>
              (India time)
            </label>
            <SubmitButton variant="secondary">Save</SubmitButton>
            <p className="w-full text-xs text-zinc-500">
              At most once a day. Super admins get an email either way (when platform email is set up in Settings).
              {opts.lastAuto && ` Last automatic update: ${opts.lastAuto.version} on ${opts.lastAuto.date} (${opts.lastAuto.result}).`}
            </p>
          </form>
        </Card>

        <Card title="WhatsApp connections">
          {sessions === null ? (
            <p className="text-sm text-zinc-500">The WhatsApp service is not part of this installation (development mode).</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-zinc-500">No bureau has linked a number yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 text-sm">
              {sessions.map((x) => (
                <li key={x.slug} className="flex flex-wrap items-center gap-2 py-1.5">
                  <span className="font-medium">{names.get(x.slug) ?? x.slug}</span>
                  <Badge tone={x.status === "open" ? "green" : x.status === "qr" ? "amber" : "red"}>{x.status === "open" ? "connected" : x.status}</Badge>
                  {x.me?.id && <span className="text-xs text-zinc-500">+{x.me.id.split(/[:@]/)[0]}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
