import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { fileUrl } from "@/lib/storage";
import { formatDateTime } from "@/lib/format";
import { MODE_LABELS, amountInWords, dueBalance, rupees } from "@/lib/money";
import { Alert, ButtonLink, Card, Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { voidPayment } from "../../actions";
import { PrintButton } from "./print-button";
import { SendMessageButton } from "@/components/send-message";
import { sendReceipt } from "@/lib/actions/messaging";
import { addressee, messageContext } from "@/lib/services/message-vars";
import { isEmailConfigured } from "@/lib/services/email";
import { whatsappConfigured } from "@/lib/services/whatsapp";
import { renderTemplate } from "@/lib/templates";

export const metadata = { title: "Receipt" };

export default async function ReceiptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { ok } = await searchParams;
  const [p, s] = await Promise.all([
    prisma.payment.findUnique({
      where: { id },
      include: {
        createdBy: { select: { name: true } },
        voidedBy: { select: { name: true } },
        due: { include: { payments: { select: { amount: true, voidedAt: true } } } },
      },
    }),
    prisma.settings.findUniqueOrThrow({ where: { id: 1 } }),
  ]);
  if (!p) notFound();
  const balance = p.due ? dueBalance(p.due, p.due.payments) : 0;
  const [family, ctx, emailReady] = await Promise.all([
    p.profileId ? prisma.profile.findUnique({ where: { id: p.profileId }, select: { fullName: true, contactName: true, phone: true, email: true } }) : null,
    messageContext(),
    isEmailConfigured(),
  ]);
  const vars = {
    ...ctx.base,
    name: family ? addressee(family) : p.payerName,
    code: p.profileCode,
    receipt_no: p.receiptNo,
    amount: rupees(p.amount),
    for: p.description,
  };
  const date = p.paidAt.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <h1 className="text-xl font-semibold">Receipt <span className="font-mono text-brand-700">{p.receiptNo}</span></h1>
        <div className="flex gap-2">
          {p.profileId && <ButtonLink href={`/profiles/${p.profileId}#money`}>Back to profile</ButtonLink>}
          {!p.voidedAt && (
            <>
              <SendMessageButton
                channel="whatsapp"
                label="WhatsApp"
                title={`Send receipt ${p.receiptNo} on WhatsApp`}
                action={sendReceipt}
                defaultTo={family?.phone}
                defaultText={renderTemplate(ctx.templates.receiptWhatsApp, vars)}
                fields={{ paymentId: p.id, channel: "whatsapp" }}
                attach={{ elementId: "receipt-sheet", as: "jpg", filename: `receipt-${p.receiptNo}.jpg` }}
                disabledReason={whatsappConfigured ? null : "WhatsApp is available on the production server"}
              />
              <SendMessageButton
                channel="email"
                label="Email"
                title={`Email receipt ${p.receiptNo}`}
                action={sendReceipt}
                defaultTo={family?.email}
                defaultSubject={`Receipt ${p.receiptNo} from ${s.bureauName}`}
                defaultText={renderTemplate(ctx.templates.receiptEmailBody, vars)}
                fields={{ paymentId: p.id, channel: "email" }}
                attach={{ elementId: "receipt-sheet", as: "jpg", filename: `receipt-${p.receiptNo}.jpg` }}
                disabledReason={emailReady ? null : "Set up email first (Settings → Email)"}
              />
            </>
          )}
          <PrintButton />
        </div>
      </div>
      {ok && <div className="mb-4 print:hidden"><Alert tone="green">{ok}</Alert></div>}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-100 p-4 print:border-0 print:bg-white print:p-0">
        <div id="receipt-sheet" className="print-sheet relative mx-auto bg-white p-10 text-[14px] text-zinc-800 shadow-lg print:shadow-none" style={{ width: 794 }}>
          {p.voidedAt && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="-rotate-12 rounded-lg border-8 border-red-500/60 px-8 text-8xl font-black tracking-widest text-red-500/50">VOID</span>
            </div>
          )}
          <div className="flex items-start justify-between gap-6 border-b-2 border-zinc-800 pb-4">
            <div className="flex items-center gap-4">
              {s.logoPath && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fileUrl(s.logoPath)} alt="" className="h-16 w-16 object-contain" />
              )}
              <div>
                <div className="text-2xl font-bold">{s.bureauName}</div>
                {s.address && <div className="whitespace-pre-line text-xs text-zinc-600">{s.address}</div>}
                <div className="text-xs text-zinc-600">{[s.phone, s.whatsapp && `WhatsApp ${s.whatsapp}`, s.email].filter(Boolean).join(" · ")}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold uppercase tracking-widest">Receipt</div>
              <div className="font-mono text-lg">{p.receiptNo}</div>
              <div className="text-sm text-zinc-600">{date}</div>
            </div>
          </div>

          <div className="space-y-4 py-6 leading-relaxed">
            <p>
              Received with thanks from <strong>{p.payerName}</strong> (profile <span className="font-mono">{p.profileCode}</span>)
              the sum of <strong>{amountInWords(p.amount)}</strong>
              {" "}by <strong>{MODE_LABELS[p.mode]}</strong>{p.reference && <> (ref. {p.reference})</>}
              {" "}towards <strong>{p.description}</strong>.
            </p>
            <div className="flex items-end justify-between gap-6">
              <div className="rounded-md border-2 border-zinc-800 px-5 py-2 text-2xl font-bold">{rupees(p.amount)}</div>
              {p.due && !p.voidedAt && (
                <div className="text-sm text-zinc-600">
                  {balance > 0 ? <>Balance due on {p.due.label}: <strong>{rupees(balance)}</strong></> : <>{p.due.label}: fully paid</>}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-end justify-between pt-10 text-sm">
            <div className="text-xs text-zinc-500">
              Recorded by {p.createdBy.name}
              {p.voidedAt && <div className="text-red-600">Voided {formatDateTime(p.voidedAt)} by {p.voidedBy?.name}: {p.voidReason}</div>}
            </div>
            <div className="text-center">
              <div className="mb-1 h-10 w-56 border-b border-zinc-400" />
              For {s.bureauName}
            </div>
          </div>
        </div>
      </div>

      {user.role === "OWNER" && !p.voidedAt && (
        <div className="mt-5 print:hidden">
          <Card title="Void this receipt">
            <p className="mb-3 text-sm text-zinc-600">
              Use this if the payment was entered by mistake or the cheque bounced. The receipt stays on record marked VOID, and the amount is owed again.
            </p>
            <form action={voidPayment} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="paymentId" value={p.id} />
              <Field label="Reason"><input name="reason" required className={inputClass + " w-72!"} /></Field>
              <SubmitButton variant="danger" confirm="Void this receipt? This cannot be undone.">Void receipt</SubmitButton>
            </form>
          </Card>
        </div>
      )}
      {!p.profileId && <p className="mt-3 text-sm text-zinc-500 print:hidden">The profile for this receipt has been deleted; the receipt is kept for the accounts. <Link href="/payments" className="underline">All payments</Link></p>}
    </>
  );
}
