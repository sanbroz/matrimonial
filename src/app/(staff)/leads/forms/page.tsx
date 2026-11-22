import Link from "next/link";
import QRCode from "qrcode";
import { requireFeature } from "@/lib/services/workflow";
import { requireUser } from "@/lib/auth/server";
import { requireTenant } from "@/lib/tenant/context";
import { tenantBaseUrl } from "@/lib/tenant/registry";
import { prisma } from "@/lib/db";
import { CHANNELS, isChannel } from "@/lib/lead-forms";
import { formatDateOnly } from "@/lib/format";
import { Badge, Card, EmptyState, Field, PageHeader, buttonClass, cx, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { CopyButton } from "@/components/small-client";
import { Flash } from "../../settings/flash";
import { createLeadForm, updateLeadForm } from "./actions";

export const metadata = { title: "Lead forms" };

export default async function LeadFormsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireUser();
  await requireFeature("leadForms");
  const tenant = await requireTenant();
  const sp = await searchParams;
  const [forms, base, converted] = await Promise.all([
    prisma.leadForm.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { leads: true } } } }),
    tenantBaseUrl(tenant),
    prisma.lead.groupBy({ by: ["leadFormId"], where: { leadFormId: { not: null }, OR: [{ status: "CONVERTED" }, { profileId: { not: null } }] }, _count: true }),
  ]);
  const convertedBy = new Map(converted.map((c) => [c.leadFormId, c._count]));
  const rows = await Promise.all(
    forms.map(async (f) => {
      const url = `${base}/join/${f.token}`;
      return { f, url, qr: await QRCode.toDataURL(url, { margin: 1, width: 480 }) };
    }),
  );

  return (
    <>
      <PageHeader
        title="Lead forms"
        subtitle="A separate enquiry link for each place you advertise. Every enquiry becomes a lead, so you can see which channel brings families."
        actions={<Link href="/leads" className={buttonClass.secondary}>Back to leads</Link>}
      />
      <Flash {...sp} />

      <Card title="New link" className="mb-5">
        <form action={createLeadForm} className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" hint="Only you see it, e.g. “Website”, “Instagram Diwali post”">
            <input name="name" required maxLength={80} className={inputClass} />
          </Field>
          <Field label="Where it will be used">
            <select name="channel" defaultValue="website" className={inputClass}>
              {Object.entries(CHANNELS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Heading on the form (optional)">
            <input name="heading" maxLength={120} placeholder="Find the right match for your family" className={inputClass} />
          </Field>
          <Field label="Short message (optional)">
            <input name="message" maxLength={400} placeholder="Leave your details and we will call you…" className={inputClass} />
          </Field>
          <div className="sm:col-span-2"><SubmitButton>Create link</SubmitButton></div>
        </form>
      </Card>

      {rows.length === 0 ? (
        <EmptyState>No links yet. Create one for your website, Instagram bio, WhatsApp status or an ad.</EmptyState>
      ) : (
        <div className="space-y-4">
          {rows.map(({ f, url, qr }) => {
            const leads = f._count.leads;
            const conv = convertedBy.get(f.id) ?? 0;
            const channel = isChannel(f.channel) ? CHANNELS[f.channel].label : f.channel;
            const embed = `<iframe src="${url}?embed=1" style="width:100%;max-width:520px;height:720px;border:0" title="Enquiry form"></iframe>`;
            return (
              <div key={f.id} id={`form-${f.id}`} className="scroll-mt-4">
                <Card
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      {f.name}
                      <Badge tone="blue">{channel}</Badge>
                      {!f.active && <Badge tone="zinc">switched off</Badge>}
                    </span>
                  }
                >
                  <div className="flex flex-col gap-4 md:flex-row">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        {[
                          ["Visits", f.views],
                          ["Enquiries", leads],
                          ["Became profiles", conv],
                        ].map(([l, n]) => (
                          <div key={l} className="rounded-md bg-zinc-50 p-2">
                            <div className="text-lg font-semibold">{n}</div>
                            <div className="text-xs text-zinc-500">{l}</div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-zinc-500">
                        {f.views > 0 ? `${Math.round((leads / f.views) * 100)}% of visitors sent an enquiry` : "No visits yet"}
                        {leads > 0 && ` · ${Math.round((conv / leads) * 100)}% of enquiries became profiles`} · created {formatDateOnly(f.createdAt)}
                      </p>
                      <div className="break-all rounded-md bg-zinc-50 p-2 font-mono text-xs">{url}</div>
                      <div className="flex flex-wrap gap-2">
                        <CopyButton text={url} />
                        <a href={url} target="_blank" rel="noreferrer" className={buttonClass.secondary}>Open</a>
                        <Link href={`/leads?form=${f.id}&status=ALL`} className={buttonClass.secondary}>See its leads</Link>
                        <form action={updateLeadForm}>
                          <input type="hidden" name="id" value={f.id} />
                          <input type="hidden" name="op" value="toggle" />
                          <SubmitButton variant="ghost" pendingText="…">{f.active ? "Switch off" : "Switch on"}</SubmitButton>
                        </form>
                      </div>
                      <details className="text-sm">
                        <summary className="cursor-pointer font-medium text-brand-700">Put it on your website</summary>
                        <p className="mt-2 text-xs text-zinc-600">Paste this where the form should appear on your website (or simply link to the address above):</p>
                        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-zinc-900 p-2 text-xs text-zinc-100">{embed}</pre>
                        <div className="mt-2"><CopyButton text={embed} label="Copy embed code" /></div>
                      </details>
                      <details className="text-sm">
                        <summary className="cursor-pointer font-medium text-brand-700">Edit name and text</summary>
                        <form action={updateLeadForm} className="mt-2 grid gap-2 sm:grid-cols-2">
                          <input type="hidden" name="id" value={f.id} />
                          <Field label="Name"><input name="name" defaultValue={f.name} required className={inputClass} /></Field>
                          <Field label="Heading"><input name="heading" defaultValue={f.heading ?? ""} className={inputClass} /></Field>
                          <Field label="Message" className="sm:col-span-2"><input name="message" defaultValue={f.message ?? ""} className={inputClass} /></Field>
                          <div><SubmitButton variant="secondary">Save</SubmitButton></div>
                        </form>
                      </details>
                    </div>
                    <div className={cx("flex shrink-0 flex-col items-center gap-1", !f.active && "opacity-40")}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qr} alt={`QR code for ${f.name}`} className="size-36 rounded border border-zinc-200 bg-white p-1" />
                      <a href={qr} download={`${f.name.replace(/[^\w-]+/g, "-")}-qr.png`} className="text-xs font-medium text-brand-700 hover:underline">
                        Download QR (for posters, posts)
                      </a>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
