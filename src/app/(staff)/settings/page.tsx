import { requireOwner } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { fileUrl } from "@/lib/storage";
import { Card, Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { saveBureauSettings } from "./actions";
import { Flash } from "./flash";

export const metadata = { title: "Settings" };

export default async function BureauSettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireOwner();
  const sp = await searchParams;
  const s = await prisma.settings.findUniqueOrThrow({ where: { id: 1 } });
  const maxCode = await prisma.profile.count();

  return (
    <form key={s.updatedAt.toISOString()} action={saveBureauSettings} className="space-y-5">
      <Flash {...sp} />
      <Card title="Bureau details (shown on biodata and receipts)">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Bureau name"><input name="bureauName" defaultValue={s.bureauName} className={inputClass} /></Field>
          <Field label="Tagline"><input name="tagline" defaultValue={s.tagline ?? ""} placeholder="e.g. Trusted matchmaking since 1998" className={inputClass} /></Field>
          <Field label="Office phone"><input name="phone" defaultValue={s.phone ?? ""} className={inputClass} /></Field>
          <Field label="WhatsApp number"><input name="whatsapp" defaultValue={s.whatsapp ?? ""} className={inputClass} /></Field>
          <Field label="Email"><input name="email" type="email" defaultValue={s.email ?? ""} className={inputClass} /></Field>
          <Field label="Address" className="sm:col-span-2"><textarea name="address" rows={2} defaultValue={s.address ?? ""} className={inputClass} /></Field>
          <div className="sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-zinc-600">Logo</span>
            <div className="flex flex-wrap items-center gap-4">
              {s.logoPath && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fileUrl(s.logoPath)} alt="Logo" className="h-16 w-auto rounded border border-zinc-200 bg-white p-1" />
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="removeLogo" /> Remove logo</label>
                </>
              )}
              <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" className="text-sm" />
            </div>
          </div>
          <div className="sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-zinc-600">Browser-tab icon (favicon)</span>
            <div className="flex flex-wrap items-center gap-4">
              {s.faviconType ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/favicon?v=${s.updatedAt.getTime()}`} alt="Browser-tab icon" className="size-10 rounded border border-zinc-200 bg-white p-0.5" />
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="removeFavicon" /> Use the standard icon</label>
                </>
              ) : (
                <span className="text-sm text-zinc-500">Standard icon</span>
              )}
              <input type="file" name="favicon" accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/jpeg,image/webp" className="text-sm" aria-label="Browser-tab icon" />
            </div>
            <p className="mt-1 text-xs text-zinc-500">Shown in the browser tab, bookmarks and on share links. A square PNG (e.g. 256×256) works best, up to 256 KB.</p>
          </div>
        </div>
      </Card>

      <Card title="Payment details (sent to clients)">
        <p className="mb-3 text-sm text-zinc-600">
          Sent with <strong>Send payment details</strong> on a lead or profile, so families can pay you directly. Fill in what you use.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="UPI ID" hint="e.g. yourbureau@okhdfcbank"><input name="paymentUpi" defaultValue={s.paymentUpi ?? ""} className={inputClass} /></Field>
          <Field label="Note (optional)" hint="e.g. Registration fee ₹1,100"><input name="paymentNote" defaultValue={s.paymentNote ?? ""} className={inputClass} /></Field>
          <Field label="Bank details" hint="Account name, account number, IFSC, bank and branch" className="sm:col-span-2">
            <textarea name="paymentBank" rows={3} defaultValue={s.paymentBank ?? ""} className={inputClass} />
          </Field>
          <div className="sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-zinc-600">UPI QR code (image)</span>
            <div className="flex flex-wrap items-center gap-4">
              {s.paymentQrPath && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fileUrl(s.paymentQrPath)} alt="UPI QR code" className="size-24 rounded border border-zinc-200 bg-white object-contain p-1" />
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="removePaymentQr" /> Remove QR code</label>
                </>
              )}
              <input type="file" name="paymentQr" accept="image/png,image/jpeg,image/webp" className="text-sm" aria-label="UPI QR code image" />
            </div>
          </div>
        </div>
      </Card>

      <Card title="How you work">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="trackMeetings" defaultChecked={s.trackMeetings} className="mt-0.5 size-4 accent-brand-600" />
          <span>
            <span className="font-medium">We arrange meetings between families</span>
            <span className="block text-zinc-500">
              Adds the &quot;Meeting scheduled&quot; and &quot;Met&quot; stages, meeting dates and meeting reminders. Untick it if you only share
              profiles: proposals then simply go Shared → Interested / Declined → Matched.
            </span>
          </span>
        </label>
      </Card>

      <Card title="Profile codes">
        <p className="mb-3 text-sm text-zinc-600">
          Families only ever see the code (e.g. <span className="font-mono">{s.profileCodePrefix}{s.nextProfileNumber}</span>), never the name or phone.
          {maxCode > 0 && " Changing these only affects new profiles."}
        </p>
        <div className="grid grid-cols-2 gap-4 sm:w-96">
          <Field label="Prefix"><input name="profileCodePrefix" defaultValue={s.profileCodePrefix} maxLength={6} className={inputClass} /></Field>
          <Field label="Next number">
            <input type="hidden" name="nextProfileNumberWas" value={s.nextProfileNumber} />
            <input name="nextProfileNumber" type="number" min={1} defaultValue={s.nextProfileNumber} className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card title="Fees">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Registration fee (₹)" hint="Charged once when a profile is registered">
            <input name="registrationFee" inputMode="numeric" defaultValue={s.registrationFee} className={inputClass} />
          </Field>
          <Field label="Default success fee (₹)" hint="Used when a match is closed, unless the client's plan sets its own. Staff can still change the amount at that time.">
            <input name="successFeeDefault" inputMode="numeric" defaultValue={s.successFeeDefault} className={inputClass} />
          </Field>
          <Field label="Receipt number prefix" hint={`Next receipt: ${s.receiptPrefix}${s.nextReceiptNumber}`}>
            <input name="receiptPrefix" defaultValue={s.receiptPrefix} maxLength={6} className={inputClass} />
          </Field>
        </div>
      </Card>

      <SubmitButton>Save settings</SubmitButton>
    </form>
  );
}
