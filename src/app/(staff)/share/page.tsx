import "@fontsource/noto-sans-gurmukhi/400.css";
import "@fontsource/noto-sans-gurmukhi/700.css";
import Link from "next/link";
import { requireUser } from "@/lib/auth/server";
import { requireTenant } from "@/lib/tenant/context";
import { tenantBaseUrl } from "@/lib/tenant/registry";
import { prisma } from "@/lib/db";
import { fileUrl } from "@/lib/storage";
import { BIODATA_SECTIONS, readBiodataOptions } from "@/lib/biodata-options";
import { LAYOUTS, MAX_SHARE_PROFILES, NAME_MODES, PRESETS, SHARE_EXPIRY_DAYS, presetOf, readShareOptions, type Layout, type NameMode } from "@/lib/share";
import { loadShareItems } from "@/lib/services/share";
import { messageContext, addressee } from "@/lib/services/message-vars";
import { isEmailConfigured } from "@/lib/services/email";
import { whatsappConfigured } from "@/lib/services/whatsapp";
import { renderTemplate } from "@/lib/templates";
import { formatDateTime } from "@/lib/format";
import { Alert, ButtonLink, Card, EmptyState, Field, PageHeader, buttonClass, cx, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { SharePages, sharePageCount } from "@/components/share-sheets";
import { ShareExport } from "@/components/share-export";
import { SendMessageButton } from "@/components/send-message";
import { AutoSubmit, CopyButton } from "@/components/small-client";
import { createShareLink, recordSharesAction, revokeShareLink, sendShare } from "./actions";

export const metadata = { title: "Share profiles" };

type SP = { id?: string | string[]; for?: string; layout?: string; preset?: string; sections?: string | string[]; lang?: string; name?: string; link?: string; ok?: string; error?: string };
const arr = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

export default async function SharePage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser();
  const tenant = await requireTenant();
  const sp = await searchParams;
  const ids = [...new Set(arr(sp.id))].slice(0, MAX_SHARE_PROFILES);
  if (!ids.length) {
    return (
      <>
        <PageHeader title="Share profiles" />
        <EmptyState>
          Choose profiles first: tick them in <Link href="/profiles" className="text-brand-700 underline">Profiles</Link> or on a
          family&apos;s <em>Suggested matches</em>, then click <strong>Share selected</strong>.
        </EmptyState>
      </>
    );
  }

  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: 1 }, select: { biodataOptions: true, logoPath: true } });
  const bo = readBiodataOptions(settings.biodataOptions);
  const opts = readShareOptions(
    { layout: sp.layout, preset: sp.preset, sections: arr(sp.sections), lang: sp.lang, name: sp.name },
    { sections: bo.sections, lang: bo.defaultLanguage, nameMode: bo.showName },
    ids.length,
  );
  const [{ items, branding, biodataOptions, statuses }, client, link, ctx, emailReady, base] = await Promise.all([
    loadShareItems(ids, opts),
    sp.for ? prisma.profile.findUnique({ where: { id: sp.for }, select: { id: true, code: true, fullName: true, gender: true, contactName: true, phone: true, email: true } }) : null,
    sp.link ? prisma.shareLink.findUnique({ where: { id: sp.link } }) : null,
    messageContext(),
    isEmailConfigured(),
    tenantBaseUrl(tenant),
  ]);
  const preset = presetOf(opts.sections, bo.sections);
  const pages = sharePageCount(items.length, opts.layout);
  const codes = items.map((i) => i.code).join(", ");
  const sameGender = client ? statuses.filter((s) => s.gender === client.gender) : [];
  const notActive = statuses.filter((s) => s.status !== "ACTIVE");
  const linkUrl = link ? `${base}/s/${link.token}` : null;
  const validTill = link ? link.expiresAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }) : "";
  const vars = { ...ctx.base, name: client ? addressee(client) : "", count: items.length, codes, link: linkUrl ?? "", valid_till: validTill };

  // Hidden fields that keep the selection + options in every form on this page
  const keep = (
    <>
      {ids.map((id) => <input key={id} type="hidden" name="id" value={id} />)}
      {client && <input type="hidden" name="for" value={client.id} />}
    </>
  );
  const keepOpts = (
    <>
      <input type="hidden" name="layout" value={opts.layout} />
      <input type="hidden" name="lang" value={opts.lang} />
      <input type="hidden" name="name" value={opts.nameMode} />
      {opts.sections.map((s) => <input key={s} type="hidden" name="sections" value={s} />)}
    </>
  );
  const without = (id: string) => {
    const q = new URLSearchParams();
    ids.filter((x) => x !== id).forEach((x) => q.append("id", x));
    if (client) q.set("for", client.id);
    q.set("layout", opts.layout);
    q.set("lang", opts.lang);
    q.set("name", opts.nameMode);
    opts.sections.forEach((s) => q.append("sections", s));
    return `/share?${q}`;
  };
  const filename = `${items.length > 1 ? `${items.length}-profiles` : items[0]?.code ?? "biodata"}${client ? `-for-${client.code}` : ""}`;
  const sendFields = { ids: ids.join(","), ...(client ? { for: client.id, record: "on" } : {}) };

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title={`Share ${items.length} profile${items.length === 1 ? "" : "s"}`}
          subtitle={client ? <>With the family of <strong>{client.code}</strong> ({client.fullName})</> : "Biodatas never include phone numbers or addresses."}
          actions={
            <>
              <ButtonLink href="/shares">Share links</ButtonLink>
              {client && <ButtonLink href={`/profiles/${client.id}/matches`}>Back to matches</ButtonLink>}
            </>
          }
        />
        <div className="mb-4 space-y-2">
          {sp.ok && <Alert tone="green">{sp.ok}</Alert>}
          {sp.error && <Alert>{sp.error}</Alert>}
          {sameGender.length > 0 && <Alert tone="amber">Same gender as {client!.code}: {sameGender.map((s) => s.code).join(", ")}. Check the selection.</Alert>}
          {notActive.length > 0 && <Alert tone="amber">Not active: {notActive.map((s) => `${s.code} (${s.status.toLowerCase().replace("_", " ")})`).join(", ")}.</Alert>}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <Card title="What to share">
            <form id="share-options" className="space-y-4">
              {keep}
              <AutoSubmit formId="share-options" />
              <div>
                <div className="mb-1.5 text-sm font-medium text-zinc-700">Layout</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(Object.keys(LAYOUTS) as Layout[]).map((l) => (
                    <label key={l} className={cx("flex cursor-pointer gap-2 rounded-md border p-2.5 text-sm", opts.layout === l ? "border-brand-500 bg-brand-50" : "border-zinc-200 hover:bg-zinc-50")}>
                      <input type="radio" name="layout" value={l} defaultChecked={opts.layout === l} className="mt-0.5 accent-brand-600" />
                      <span>
                        <span className="font-medium">{LAYOUTS[l].label}</span>
                        <span className="block text-xs text-zinc-500">{LAYOUTS[l].hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1.5 flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-700">
                  Details to include
                  <span className="flex flex-wrap gap-1 font-normal">
                    {Object.entries(PRESETS).map(([k, p]) => {
                      const q = new URLSearchParams();
                      ids.forEach((x) => q.append("id", x));
                      if (client) q.set("for", client.id);
                      q.set("layout", opts.layout);
                      q.set("lang", opts.lang);
                      q.set("name", opts.nameMode);
                      q.set("preset", k);
                      return (
                        <Link key={k} href={`/share?${q}`} className={cx("rounded-full border px-2.5 py-0.5 text-xs", preset === k ? "border-brand-500 bg-brand-50 text-brand-700" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50")}>
                          {p.label}
                        </Link>
                      );
                    })}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 2xl:grid-cols-3">
                  {Object.entries(BIODATA_SECTIONS).map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="sections" value={k} defaultChecked={opts.sections.includes(k as never)} className="size-4 accent-brand-600" />
                      {label}
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-xs text-zinc-500">Phone numbers, addresses and parents&apos; names are never included.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-zinc-700">Name</span>
                {(Object.keys(NAME_MODES) as NameMode[]).map((m) => (
                  <label key={m} className="flex items-center gap-1.5 text-sm">
                    <input type="radio" name="name" value={m} defaultChecked={opts.nameMode === m} className="accent-brand-600" />
                    {NAME_MODES[m]}
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-zinc-700">Language</span>
                {(["en", "pa"] as const).map((l) => (
                  <label key={l} className="flex items-center gap-1.5 text-sm">
                    <input type="radio" name="lang" value={l} defaultChecked={opts.lang === l} className="accent-brand-600" />
                    {l === "en" ? "English" : "ਪੰਜਾਬੀ"}
                  </label>
                ))}
                <noscript><button className={buttonClass.secondary}>Update preview</button></noscript>
              </div>
            </form>
            <div className="mt-4 border-t border-zinc-100 pt-3">
              <div className="mb-1.5 text-sm font-medium text-zinc-700">Profiles ({items.length})</div>
              <div className="flex flex-wrap gap-1.5">
                {items.map((it) => (
                  <span key={it.id} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 py-0.5 pl-2.5 pr-1 font-mono text-xs">
                    {it.code}
                    {items.length > 1 && (
                      <Link href={without(it.id)} aria-label={`Remove ${it.code}`} className="rounded-full px-1.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900">×</Link>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </Card>

          <div className="space-y-4">
            <Card title="Download">
              <ShareExport pages={pages} filename={filename} />
              <p className="mt-2 text-xs text-zinc-500">{pages} A4 page{pages === 1 ? "" : "s"}.</p>
            </Card>

            <Card title="Share link">
              {linkUrl && link ? (
                <div className="space-y-2">
                  <div className="break-all rounded-md bg-emerald-50 p-2 text-sm text-emerald-900">{linkUrl}</div>
                  <div className="flex flex-wrap gap-2">
                    <CopyButton text={linkUrl} />
                    <a href={linkUrl} target="_blank" rel="noreferrer" className={buttonClass.secondary}>Open</a>
                    <form action={revokeShareLink}>
                      <input type="hidden" name="linkId" value={link.id} />
                      <input type="hidden" name="returnTo" value={without("__none__")} />
                      <SubmitButton variant="danger" pendingText="…" confirm="Switch this link off? People who have it can no longer open it.">Switch off</SubmitButton>
                    </form>
                  </div>
                  <p className="text-xs text-zinc-500">Works until {validTill} ({formatDateTime(link.expiresAt)}). Anyone with the link can view it, without signing in.</p>
                  <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-2">
                    <SendMessageButton
                      channel="whatsapp"
                      label="Send link on WhatsApp"
                      title={`Send ${items.length} profiles on WhatsApp`}
                      action={sendShare}
                      defaultTo={client?.phone}
                      defaultText={renderTemplate(ctx.templates.shareWhatsApp, vars)}
                      fields={{ ...sendFields, channel: "whatsapp" }}
                      disabledReason={whatsappConfigured ? null : "WhatsApp is available on the production server"}
                    />
                    <SendMessageButton
                      channel="email"
                      label="Email link + PDF"
                      title={`Email ${items.length} profiles`}
                      action={sendShare}
                      defaultTo={client?.email}
                      defaultSubject={renderTemplate(ctx.templates.shareEmailSubject, vars)}
                      defaultText={renderTemplate(ctx.templates.shareEmailBody, vars)}
                      fields={{ ...sendFields, channel: "email" }}
                      attach={{ elementId: Array.from({ length: pages }, (_, i) => `share-page-${i}`), as: "pdf", filename: `${filename}.pdf` }}
                      disabledReason={emailReady ? null : "Set up email first (Settings → Email)"}
                    />
                  </div>
                </div>
              ) : (
                <form action={createShareLink} className="space-y-3">
                  {keep}
                  {keepOpts}
                  <p className="text-sm text-zinc-600">
                    A web page with these {items.length} biodata{items.length === 1 ? "" : "s"} (as previewed) that the family can open on
                    their phone and download as PDF. No sign-in needed; it stops working when it expires.
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <Field label="Works for">
                      <select name="days" defaultValue="14" className={inputClass + " w-32!"}>
                        {SHARE_EXPIRY_DAYS.map((d) => <option key={d} value={d}>{d} days</option>)}
                      </select>
                    </Field>
                    <Field label="Title (optional)">
                      <input name="title" placeholder={client ? `For ${client.code}` : "e.g. Canada matches"} className={inputClass + " w-44!"} />
                    </Field>
                  </div>
                  {client && (
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="record" defaultChecked className="size-4 accent-brand-600" />
                      Record as shared with {client.code}&apos;s family
                    </label>
                  )}
                  <SubmitButton pendingText="Creating…">Create share link</SubmitButton>
                </form>
              )}
            </Card>

            {client && !linkUrl && (
              <Card title={`Sent another way?`}>
                <form action={recordSharesAction} className="flex flex-wrap items-center gap-2 text-sm">
                  {keep}
                  {keepOpts}
                  <span>Record these as shared with <strong>{client.code}</strong>&apos;s family.</span>
                  <SubmitButton variant="secondary" pendingText="Saving…">Record as shared</SubmitButton>
                </form>
              </Card>
            )}
          </div>
        </div>

        <h2 className="mb-2 mt-6 text-sm font-semibold text-zinc-700">Preview</h2>
      </div>

      <div className="print-stack flex flex-col gap-6 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-100 p-4 print:overflow-visible print:border-0 print:bg-white print:p-0">
        <SharePages
          items={items.map((it) => ({ id: it.id, content: it.content, photoUrls: it.photoPaths.map(fileUrl) }))}
          layout={opts.layout}
          lang={opts.lang}
          options={biodataOptions}
          branding={{ ...branding, logoUrl: settings.logoPath ? fileUrl(settings.logoPath) : null }}
        />
      </div>
    </>
  );
}
