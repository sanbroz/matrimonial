import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { Badge, Card } from "@/components/ui";

const KIND: Record<string, string> = {
  biodata: "Biodata",
  receipt: "Receipt",
  payment_due: "Payment reminder",
  renewal: "Renewal reminder",
  meeting: "Meeting reminder",
  test: "Test",
};

/** Emails and WhatsApp messages sent to this family. */
export async function MessagesLog({ profileId }: { profileId: string }) {
  const messages = await prisma.outboundMessage.findMany({
    where: { profileId },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: { createdBy: { select: { name: true } } },
  });
  if (messages.length === 0) return null;
  return (
    <Card title={`Messages sent (${messages.length})`}>
      <ul className="divide-y divide-zinc-100 text-sm">
        {messages.map((m) => (
          <li key={m.id} className="py-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Badge tone={m.channel === "WHATSAPP" ? "green" : "blue"}>{m.channel === "WHATSAPP" ? "WhatsApp" : "Email"}</Badge>
              <span className="font-medium">{KIND[m.kind] ?? m.kind}</span>
              <span className="text-zinc-500">to {m.to}</span>
              {m.hasAttachment && <span title="With attachment">📎</span>}
              {m.status === "FAILED" && <Badge tone="red">Failed</Badge>}
              <span className="ml-auto text-xs text-zinc-400">{formatDateTime(m.createdAt)}{m.createdBy && ` · ${m.createdBy.name}`}</span>
            </div>
            <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-xs text-zinc-600">{m.subject ? `${m.subject}: ` : ""}{m.body}</p>
            {m.error && <p className="text-xs text-red-600">{m.error}</p>}
          </li>
        ))}
      </ul>
    </Card>
  );
}
