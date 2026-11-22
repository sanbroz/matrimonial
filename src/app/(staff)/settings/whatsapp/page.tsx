import { requireOwner } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { getWhatsAppStatus } from "@/lib/services/whatsapp";
import { formatDateTime } from "@/lib/format";
import { Alert, Badge, Card, Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { saveWhatsAppOptions, sendTestWhatsApp, unlinkWhatsApp } from "./actions";
import { LinkStatus } from "./link-status";
import { LibraryCard } from "./library-card";
import { readWhatsAppOptions } from "@/lib/whatsapp-options";
import { Flash } from "../flash";

export const metadata = { title: "WhatsApp" };

export default async function WhatsAppSettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireOwner();
  const sp = await searchParams;
  const [status, recent, s] = await Promise.all([
    getWhatsAppStatus(),
    prisma.outboundMessage.findMany({ where: { channel: "WHATSAPP" }, orderBy: { createdAt: "desc" }, take: 15 }),
    prisma.settings.findUniqueOrThrow({ where: { id: 1 }, select: { whatsappOptions: true } }),
  ]);
  const waOpts = readWhatsAppOptions(s.whatsappOptions);

  return (
    <div className="space-y-5">
      <Flash {...sp} />
      <Alert tone="amber">
        WhatsApp here works like WhatsApp Web on a linked device. This isn&apos;t an official WhatsApp business connection,
        so use a <strong>separate bureau number</strong> and send messages people expect (biodata they asked for, reminders to
        your clients). Unsolicited or bulk messages can get the number <strong>banned</strong>. The app sends one message at a
        time with a short pause between them.
      </Alert>

      <Card title="Linked number">
        <LinkStatus initial={status} />
        {status.status !== "unavailable" && (
          <form action={unlinkWhatsApp} className="mt-4 border-t border-zinc-100 pt-3">
            <SubmitButton variant="danger" pendingText="Unlinking…" confirm="Unlink this WhatsApp number from the app?">Unlink number</SubmitButton>
          </form>
        )}
      </Card>

      {status.status !== "unavailable" && (
        <Card title="WhatsApp library (Baileys) updates">
          <p className="mb-3 text-sm text-zinc-600">
            WhatsApp changes its app regularly. New releases of the library keep the connection working, so install them
            when offered. Your linked number stays linked.
          </p>
          <LibraryCard />
          <form action={saveWhatsAppOptions} className="mt-4 flex flex-wrap items-end gap-3 border-t border-zinc-100 pt-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="autoUpdate" defaultChecked={waOpts.autoUpdate} className="size-4 accent-brand-600" />
              Install new versions automatically
            </label>
            <label className="flex items-center gap-2">
              at
              <select name="hour" defaultValue={waOpts.hour.slice(0, 2)} className={inputClass + " w-24! py-1.5!"}>
                {Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0")).map((h) => (
                  <option key={h} value={h}>{h}:00</option>
                ))}
              </select>
              (India time)
            </label>
            <SubmitButton variant="secondary">Save</SubmitButton>
            <p className="w-full text-xs text-zinc-500">
              At most once a day. If WhatsApp doesn&apos;t reconnect after an update, the previous version is restored and that
              version isn&apos;t tried automatically again. Owners get an email either way (when email is set up).
              {waOpts.lastAuto && ` Last automatic update: ${waOpts.lastAuto.version} on ${waOpts.lastAuto.date} (${waOpts.lastAuto.result}).`}
            </p>
          </form>
        </Card>
      )}

      <Card title="Send a test message">
        <form action={sendTestWhatsApp} className="flex flex-wrap items-end gap-2">
          <Field label="Mobile number" hint="10-digit Indian number or with country code (+1…)"><input name="phone" required className={inputClass + " w-56!"} /></Field>
          <SubmitButton variant="secondary" pendingText="Sending…">Send test</SubmitButton>
        </form>
      </Card>

      <Card title="Recent WhatsApp messages">
        {recent.length === 0 ? (
          <p className="text-sm text-zinc-500">None yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 text-sm">
            {recent.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
                <span className="w-40 shrink-0 text-xs text-zinc-500">{formatDateTime(m.createdAt)}</span>
                <span className="w-32 shrink-0">{m.to}</span>
                <span className="min-w-0 flex-1 truncate text-zinc-600">{m.hasAttachment && "📎 "}{m.body}</span>
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
