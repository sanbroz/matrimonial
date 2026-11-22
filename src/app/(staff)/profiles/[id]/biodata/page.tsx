import "@fontsource/noto-sans-gurmukhi/400.css";
import "@fontsource/noto-sans-gurmukhi/700.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { fileUrl } from "@/lib/storage";
import { buildBiodata } from "@/lib/biodata";
import { nowIST } from "@/lib/format";
import { readBiodataOptions } from "@/lib/biodata-options";
import { Alert, ButtonLink, Card, cx, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { BiodataSheet } from "@/components/biodata-sheet";
import { ExportButtons } from "./export-buttons";
import { shareByCode, shareMatch } from "../matches/actions";
import { SendMessageButton } from "@/components/send-message";
import { sendBiodata } from "@/lib/actions/messaging";
import { addressee, messageContext } from "@/lib/services/message-vars";
import { isEmailConfigured } from "@/lib/services/email";
import { whatsappConfigured } from "@/lib/services/whatsapp";
import { renderTemplate } from "@/lib/templates";

export const metadata = { title: "Biodata" };

export default async function BiodataPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string; for?: string; ok?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const [profile, settings] = await Promise.all([
    prisma.profile.findUnique({
      where: { id },
      include: {
        preference: true,
        photos: { where: { onBiodata: true }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 3 },
      },
    }),
    prisma.settings.findUniqueOrThrow({ where: { id: 1 } }),
  ]);
  if (!profile) notFound();

  const options = readBiodataOptions(settings.biodataOptions);
  const lang = sp.lang === "pa" || sp.lang === "en" ? sp.lang : options.defaultLanguage;
  const content = buildBiodata(profile, options, lang, nowIST());

  // Opened from a client's suggestions: offer to record the share for that family
  const client = sp.for
    ? await prisma.profile.findUnique({
        where: { id: sp.for },
        select: { id: true, code: true, fullName: true, contactName: true, phone: true, email: true },
      })
    : null;
  const [ctx, emailReady] = await Promise.all([messageContext(), isEmailConfigured()]);
  const vars = { ...ctx.base, code: profile.code, name: client ? addressee(client) : "" };
  const sendFields = { profileId: profile.id, ...(client ? { forClientId: client.id } : {}) };
  const alreadyShared = client
    ? await prisma.proposal.findUnique({ where: { fromProfileId_toProfileId: { fromProfileId: client.id, toProfileId: profile.id } } })
    : null;
  const langHref = (l: string) => `?lang=${l}${client ? `&for=${client.id}` : ""}`;

  return (
    <>
      <div className="print:hidden">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">
              Biodata <span className="font-mono text-brand-700">{profile.code}</span>
            </h1>
            <p className="text-sm text-zinc-500">
              {options.showName === "none" ? "Shows the profile code only (no name)." : `Shows the ${options.showName === "first" ? "first" : "full"} name and profile code.`} Parents&apos; names, phone and address are never included.
            </p>
          </div>
          <div className="flex gap-2">
            <ButtonLink href={`/share?id=${profile.id}${client ? `&for=${client.id}` : ""}&lang=${lang}`}>Choose details / link</ButtonLink>
            <ButtonLink href={`/profiles/${profile.id}`}>Back to profile</ButtonLink>
            {user.role === "OWNER" && <ButtonLink href="/settings/biodata">Biodata settings</ButtonLink>}
          </div>
        </div>

        <div className="mb-4 space-y-2">
          {sp.ok && <Alert tone="green">{sp.ok}</Alert>}
          {sp.error && <Alert>{sp.error}</Alert>}
          {profile.photos.length === 0 && options.sections.includes("photo") && (
            <Alert tone="amber">No photo is marked for the biodata. <Link href={`/profiles/${profile.id}#photos`} className="underline">Add or choose photos</Link></Alert>
          )}
          {profile.status !== "ACTIVE" && <Alert tone="amber">This profile is {profile.status.toLowerCase().replace("_", " ")}. Check before sharing.</Alert>}
        </div>

        <Card className="mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex overflow-hidden rounded-md border border-zinc-300">
              {(["en", "pa"] as const).map((l) => (
                <Link
                  key={l}
                  href={langHref(l)}
                  className={cx("px-3 py-2 text-sm font-medium", lang === l ? "bg-brand-600 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50")}
                >
                  {l === "en" ? "English" : "ਪੰਜਾਬੀ"}
                </Link>
              ))}
            </div>
            <ExportButtons code={profile.code} lang={lang} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
            <span className="text-sm text-zinc-600">Send{client ? ` to ${client.code}'s family` : ""}:</span>
            <SendMessageButton
              channel="whatsapp"
              label="WhatsApp"
              title={`Send biodata ${profile.code} on WhatsApp`}
              action={sendBiodata}
              defaultTo={client?.phone}
              defaultText={renderTemplate(ctx.templates.biodataWhatsApp, vars)}
              fields={{ ...sendFields, channel: "whatsapp" }}
              attach={{ elementId: "biodata-sheet", as: "jpg", filename: `${profile.code}-biodata${lang === "pa" ? "-punjabi" : ""}.jpg` }}
              disabledReason={whatsappConfigured ? null : "WhatsApp is available on the production server"}
            />
            <SendMessageButton
              channel="email"
              label="Email"
              title={`Email biodata ${profile.code}`}
              action={sendBiodata}
              defaultTo={client?.email}
              defaultSubject={renderTemplate(ctx.templates.biodataEmailSubject, vars)}
              defaultText={renderTemplate(ctx.templates.biodataEmailBody, vars)}
              fields={{ ...sendFields, channel: "email" }}
              attach={{ elementId: "biodata-sheet", as: "pdf", filename: `${profile.code}-biodata${lang === "pa" ? "-punjabi" : ""}.pdf` }}
              disabledReason={emailReady ? null : "Set up email first (Settings → Email)"}
            />
          </div>
          <div className="mt-3 border-t border-zinc-100 pt-3">
            {client ? (
              alreadyShared ? (
                <p className="text-sm text-emerald-700">Recorded as shared with {client.code} ({client.fullName})&apos;s family.</p>
              ) : (
                <form action={shareMatch} className="flex flex-wrap items-center gap-2 text-sm">
                  <input type="hidden" name="clientId" value={client.id} />
                  <input type="hidden" name="candidateId" value={profile.id} />
                  <input type="hidden" name="returnTo" value={`/profiles/${profile.id}/biodata?lang=${lang}&for=${client.id}`} />
                  <span>After sending, record it for <strong>{client.code}</strong> ({client.fullName}):</span>
                  <SubmitButton variant="secondary" pendingText="Saving…">Mark as shared with {client.code}</SubmitButton>
                </form>
              )
            ) : (
              <form action={shareByCode} className="flex flex-wrap items-center gap-2 text-sm">
                <input type="hidden" name="candidateId" value={profile.id} />
                <input type="hidden" name="lang" value={lang} />
                <span>Sent this to a family? Record it:</span>
                <input name="clientCode" aria-label="Profile code of the family it was sent to" placeholder="Their profile code" className={inputClass + " w-44! py-1.5! uppercase"} />
                <SubmitButton variant="secondary" pendingText="Saving…">Record share</SubmitButton>
              </form>
            )}
          </div>
        </Card>
      </div>

      {/* The sheet: scrolls sideways on small screens; printed alone (see globals.css) */}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-100 p-4 print:overflow-visible print:border-0 print:bg-white print:p-0">
        <div className="mx-auto w-fit shadow-lg print:shadow-none">
          <BiodataSheet
            content={content}
            options={options}
            branding={{
              bureauName: settings.bureauName,
              tagline: settings.tagline,
              phone: settings.phone,
              whatsapp: settings.whatsapp,
              logoUrl: settings.logoPath ? fileUrl(settings.logoPath) : null,
            }}
            photoUrls={profile.photos.map((p) => fileUrl(p.path))}
          />
        </div>
      </div>
    </>
  );
}
