import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant/context";
import { tenantBaseUrl } from "@/lib/tenant/registry";
import { FORM_LINK_DAYS, activeFormLinkFor } from "@/lib/services/form-links";
import { messageContext, addressee } from "@/lib/services/message-vars";
import { isEmailConfigured } from "@/lib/services/email";
import { whatsappConfigured } from "@/lib/services/whatsapp";
import { renderTemplate } from "@/lib/templates";
import { formatDateTime } from "@/lib/format";
import { createFormLink, revokeFormLink, sendFormLink } from "@/lib/actions/form-links";
import { Card, Field, buttonClass, inputClass } from "./ui";
import { SubmitButton } from "./submit-button";
import { SendMessageButton } from "./send-message";
import { CopyButton } from "./small-client";

/**
 * "Let the family fill in their profile": a link (no login) to a form with this profile's details,
 * which the family completes or corrects themselves, with photos. Staff are told when they do.
 */
export async function FormLinkCard({ profileId, returnTo }: { profileId: string; returnTo: string }) {
  const [profile, link, tenant] = await Promise.all([
    prisma.profile.findUnique({ where: { id: profileId }, select: { fullName: true, contactName: true, phone: true, email: true } }),
    activeFormLinkFor(profileId),
    requireTenant(),
  ]);
  if (!profile) return null;
  const base = await tenantBaseUrl(tenant);
  const url = link ? `${base}/f/${link.token}` : null;

  return (
    <div id="family-form" className="scroll-mt-4">
      <Card title="Family fills in their profile">
        {link && url ? (
          <div className="space-y-2 text-sm">
            <div className="break-all rounded-md bg-emerald-50 p-2 text-emerald-900">{url}</div>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={url} />
              <FormLinkSend profileId={profileId} url={url} expiresAt={link.expiresAt} profile={profile} />
            </div>
            <p className="text-xs text-zinc-500">
              Works until {formatDateTime(link.expiresAt)}.{" "}
              {link.submissions > 0
                ? `Filled in ${link.submissions} time${link.submissions === 1 ? "" : "s"}, last ${formatDateTime(link.lastSubmittedAt)}.`
                : "Not filled in yet."}
            </p>
            <form action={revokeFormLink}>
              <input type="hidden" name="linkId" value={link.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <SubmitButton variant="ghost" pendingText="…" confirm="Switch this link off? The family can no longer use it.">Switch link off</SubmitButton>
            </form>
          </div>
        ) : (
          <form action={createFormLink} className="space-y-2 text-sm">
            <input type="hidden" name="profileId" value={profileId} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <p className="text-zinc-600">
              Send the family a link to fill in or correct their details and add photos themselves. No sign-in; you&apos;re told
              when they&apos;ve done it.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Works for">
                <select name="days" defaultValue="7" className={inputClass + " w-28!"}>
                  {FORM_LINK_DAYS.map((d) => <option key={d} value={d}>{d} days</option>)}
                </select>
              </Field>
              <SubmitButton variant="secondary" pendingText="Creating…">Create link</SubmitButton>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}

async function FormLinkSend({
  profileId,
  url,
  expiresAt,
  profile,
}: {
  profileId: string;
  url: string;
  expiresAt: Date;
  profile: { fullName: string; contactName: string | null; phone: string | null; email: string | null };
}) {
  const [ctx, emailReady] = await Promise.all([messageContext(), isEmailConfigured()]);
  const text = renderTemplate(ctx.templates.formLinkWhatsApp, {
    ...ctx.base,
    name: addressee(profile),
    link: url,
    valid_till: expiresAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", timeZone: "Asia/Kolkata" }),
  });
  return (
    <>
      <SendMessageButton
        channel="whatsapp"
        label="Send on WhatsApp"
        title="Send the form link on WhatsApp"
        action={sendFormLink}
        defaultTo={profile.phone}
        defaultText={text}
        fields={{ profileId, channel: "whatsapp" }}
        disabledReason={whatsappConfigured ? null : "WhatsApp is available on the production server"}
      />
      <SendMessageButton
        channel="email"
        label="Email"
        title="Email the form link"
        action={sendFormLink}
        defaultTo={profile.email}
        defaultSubject={`Your profile with ${ctx.base.bureau}`}
        defaultText={text}
        fields={{ profileId, channel: "email" }}
        disabledReason={emailReady ? null : "Set up email first (Settings → Email)"}
      />
      <a href={url} target="_blank" rel="noreferrer" className={buttonClass.ghost}>Open</a>
    </>
  );
}
