import Link from "next/link";
import { prisma } from "@/lib/db";
import { messageContext } from "@/lib/services/message-vars";
import { isEmailConfigured } from "@/lib/services/email";
import { whatsappConfigured } from "@/lib/services/whatsapp";
import { paymentDetailsText, renderTemplate } from "@/lib/templates";
import { sendPaymentDetails } from "@/lib/actions/messaging";
import { SendMessageButton } from "./send-message";

/**
 * "Send payment details" (WhatsApp, and email when there's an address) for a lead or a profile's
 * family. Uses the UPI / bank / QR set in Settings → Bureau.
 */
export async function PaymentDetailsButtons({
  name,
  phone,
  email,
  profileId,
  leadId,
}: {
  name: string;
  phone?: string | null;
  email?: string | null;
  profileId?: string;
  leadId?: string;
}) {
  const s = await prisma.settings.findUniqueOrThrow({ where: { id: 1 }, select: { paymentUpi: true, paymentBank: true, paymentNote: true, paymentQrPath: true } });
  if (!s.paymentUpi && !s.paymentBank && !s.paymentQrPath) {
    return (
      <p className="text-xs text-zinc-500">
        To send payment details, add your UPI / bank details in <Link href="/settings" className="text-brand-700 underline">Settings → Bureau</Link>.
      </p>
    );
  }
  const [ctx, emailReady] = await Promise.all([messageContext(), isEmailConfigured()]);
  const text = renderTemplate(ctx.templates.paymentWhatsApp, { ...ctx.base, name, payment_details: paymentDetailsText(s, !!s.paymentQrPath) });
  const fields = { ...(profileId ? { profileId } : {}), ...(leadId ? { leadId } : {}) };
  return (
    <div className="flex flex-wrap gap-2">
      <SendMessageButton
        channel="whatsapp"
        label="Send payment details"
        title="Payment details on WhatsApp"
        action={sendPaymentDetails}
        defaultTo={phone}
        defaultText={text}
        fields={{ ...fields, channel: "whatsapp" }}
        disabledReason={whatsappConfigured ? null : "WhatsApp is available on the production server"}
      />
      {(email || profileId) && (
        <SendMessageButton
          channel="email"
          label="Email payment details"
          title="Payment details by email"
          action={sendPaymentDetails}
          defaultTo={email}
          defaultSubject={renderTemplate(ctx.templates.paymentEmailSubject, ctx.base)}
          defaultText={text}
          fields={{ ...fields, channel: "email" }}
          disabledReason={emailReady ? null : "Set up email first (Settings → Email)"}
        />
      )}
      {s.paymentQrPath && <span className="self-center text-xs text-zinc-500">The QR code is attached.</span>}
    </div>
  );
}
