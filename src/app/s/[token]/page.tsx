import "@fontsource/noto-sans-gurmukhi/400.css";
import "@fontsource/noto-sans-gurmukhi/700.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant/context";
import { findActiveShareLink, loadShareItems } from "@/lib/services/share";
import { readShareOptions, type Layout } from "@/lib/share";
import { SharePages, sharePageCount } from "@/components/share-sheets";
import { ShareExport } from "@/components/share-export";
import { FitWidth } from "@/components/fit-width";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Shared profiles" }, robots: { index: false, follow: false }, referrer: "no-referrer" };

/**
 * Public page for a share link (no login). Shows only biodata content of the profiles in the link:
 * profile codes, never names, phones or addresses. Photos and logo come from routes that check the link.
 */
export default async function SharedProfilesPage({ params }: { params: Promise<{ token: string }> }) {
  const tenant = await requireTenant();
  if (tenant.status === "SUSPENDED") notFound();
  const { token } = await params;
  const link = await findActiveShareLink(token);
  const settings = await prisma.settings.findUnique({ where: { id: 1 }, select: { bureauName: true, phone: true, whatsapp: true } });

  if (!link) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold">This link has expired</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Please ask {settings?.bureauName ?? "the bureau"} to send the profiles again
            {settings?.phone ? <> ({settings.phone})</> : null}.
          </p>
        </div>
      </main>
    );
  }

  await prisma.shareLink.updateMany({ where: { id: link.id }, data: { views: { increment: 1 }, lastViewedAt: new Date() } });
  const opts = readShareOptions({ layout: link.layout as Layout, sections: link.sections, lang: link.lang }, { sections: [], lang: "en" }, link.profileIds.length);
  const { items, branding, biodataOptions } = await loadShareItems(link.profileIds, opts);
  const pages = sharePageCount(items.length, opts.layout);
  const contact = [settings?.phone, settings?.whatsapp && `WhatsApp ${settings.whatsapp}`].filter(Boolean).join(" · ");

  return (
    <main className="mx-auto max-w-[860px] px-3 py-4 sm:px-4">
      <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm print:hidden">
        <h1 className="text-lg font-semibold">{link.title || `${items.length} profile${items.length === 1 ? "" : "s"} from ${branding.bureauName}`}</h1>
        <p className="mt-0.5 text-sm text-zinc-600">
          Shared by {branding.bureauName}
          {contact && <> · {contact}</>}. Available until{" "}
          {link.expiresAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })}.
        </p>
        <div className="mt-3">
          <ShareExport pages={pages} filename={`${branding.bureauName.replace(/[^\w]+/g, "-")}-profiles`} compact />
        </div>
      </div>
      {items.length === 0 ? (
        <p className="text-center text-sm text-zinc-500">These profiles are no longer available.</p>
      ) : (
        <FitWidth width={794}>
          <div className="print-stack flex flex-col gap-4">
            <SharePages
              items={items.map((it) => ({ id: it.id, content: it.content, photoUrls: it.photoIds.map((pid) => `/s/${link.token}/p/${pid}`) }))}
              layout={opts.layout}
              lang={opts.lang}
              options={biodataOptions}
              branding={{ ...branding, logoUrl: branding.logoPath ? `/s/${link.token}/logo` : null }}
            />
          </div>
        </FitWidth>
      )}
    </main>
  );
}
