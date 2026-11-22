import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant/context";
import { cx } from "@/components/ui";
import { EnquiryForm } from "./enquiry-form";
import { submitEnquiry } from "./actions";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = await prisma.settings.findUnique({ where: { id: 1 }, select: { bureauName: true } }).catch(() => null);
  return { title: { absolute: s ? `Enquiry · ${s.bureauName}` : "Enquiry" }, robots: { index: false, follow: false } };
}

/**
 * A bureau's public enquiry form for one channel / campaign (/join/<token>). Works on its own,
 * or inside an iframe on the bureau's website (?embed=1 drops the outer page).
 */
export default async function JoinPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ embed?: string }> }) {
  const tenant = await requireTenant();
  if (tenant.status === "SUSPENDED") notFound();
  const { token } = await params;
  const { embed } = await searchParams;
  const [form, s] = await Promise.all([
    prisma.leadForm.findUnique({ where: { token } }),
    prisma.settings.findUnique({ where: { id: 1 }, select: { bureauName: true, tagline: true, phone: true, whatsapp: true, logoPath: true } }),
  ]);
  if (!form || !s) notFound();
  if (form.active) await prisma.leadForm.update({ where: { id: form.id }, data: { views: { increment: 1 } } });
  const contact = [s.phone, s.whatsapp && `WhatsApp ${s.whatsapp}`].filter(Boolean).join(" · ");
  const framed = embed === "1";

  return (
    <main className={cx("mx-auto max-w-lg", framed ? "p-0" : "px-4 py-6 sm:py-10")}>
      <div className={cx("bg-white", framed ? "p-4" : "rounded-xl border border-zinc-200 p-5 shadow-sm sm:p-6")}>
        <div className="mb-4 flex items-center gap-3">
          {s.logoPath && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/join/${token}/logo`} alt="" className="size-12 rounded-md object-contain" />
          )}
          <div>
            <div className="font-semibold text-brand-700">{s.bureauName}</div>
            {s.tagline && <div className="text-xs text-zinc-500">{s.tagline}</div>}
          </div>
        </div>
        {form.active ? (
          <>
            <h1 className="text-lg font-semibold">{form.heading || "Find the right match for your family"}</h1>
            <p className="mb-4 mt-1 text-sm text-zinc-600">
              {form.message || "Leave your details and we will call you to understand what you are looking for. It's free to enquire."}
            </p>
            <EnquiryForm action={submitEnquiry.bind(null, token)} bureauName={s.bureauName} />
          </>
        ) : (
          <p className="text-sm text-zinc-600">This form is closed. {contact ? <>Please contact us: {contact}.</> : null}</p>
        )}
        {contact && form.active && <p className="mt-4 text-center text-xs text-zinc-500">Or call us: {contact}</p>}
      </div>
    </main>
  );
}
