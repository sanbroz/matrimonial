import { requireOwner } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { getWhatsAppStatus } from "@/lib/services/whatsapp";
import { formatDateTime } from "@/lib/format";
import { Alert, Badge, Card, Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { linkWhatsApp, sendTestWhatsApp, unlinkWhatsApp } from "./actions";
import { LinkStatus } from "./link-status";
import { Flash } from "../flash";

export const metadata = { title: "WhatsApp" };

export default async function WhatsAppSettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireOwner();
  const sp = await searchParams;
  const [status, recent] = await Promise.all([
    getWhatsAppStatus(),
    prisma.outboundMessage.findMany({ where: { channel: "WHATSAPP" }, orderBy: { createdAt: "desc" }, take: 15 }),
  ]);

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
        <LinkStatus key={`${status.status}:${status.me?.id ?? ""}`} initial={status} />
        {status.status === "not_linked" && (
          <form action={linkWhatsApp} className="mt-4">
            <SubmitButton pendingText="Starting…">Link a WhatsApp number</SubmitButton>
          </form>
        )}
        {!["unavailable", "not_linked"].includes(status.status) && (
          <form action={unlinkWhatsApp} className="mt-4 border-t border-zinc-100 pt-3">
            <SubmitButton variant="danger" pendingText="Unlinking…" confirm="Unlink this WhatsApp number from the app?">Unlink number</SubmitButton>
          </form>
        )}
      </Card>

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
