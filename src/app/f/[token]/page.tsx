import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant/context";
import { loadOptions } from "@/lib/services/profiles";
import { hiddenProfileFields } from "@/lib/services/workflow";
import { FAMILY_MAX_PHOTOS, FAMILY_SECTIONS, findActiveFormLink } from "@/lib/services/form-links";
import { profileToFormValues } from "@/lib/profile-form-values";
import { ProfileForm } from "@/app/(staff)/profiles/profile-form";
import { PhotoUploader } from "@/app/(staff)/profiles/[id]/photo-uploader";
import { Card } from "@/components/ui";
import { submitFamilyForm, uploadFamilyPhoto } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Your profile" }, robots: { index: false, follow: false }, referrer: "no-referrer" };

/** The family's own form (no login): fill in or correct the profile, add photos. */
export default async function FamilyFormPage({ params }: { params: Promise<{ token: string }> }) {
  const tenant = await requireTenant();
  if (tenant.status === "SUSPENDED") notFound();
  const { token } = await params;
  const [link, settings] = await Promise.all([
    findActiveFormLink(token),
    prisma.settings.findUnique({ where: { id: 1 }, select: { bureauName: true, phone: true, whatsapp: true } }),
  ]);
  const contact = [settings?.phone, settings?.whatsapp && `WhatsApp ${settings.whatsapp}`].filter(Boolean).join(" · ");

  if (!link) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold">This link has expired</h1>
          <p className="mt-2 text-sm text-zinc-600">Please ask {settings?.bureauName ?? "the bureau"} for a new one{contact ? <> ({contact})</> : null}.</p>
        </div>
      </main>
    );
  }

  const [profile, options, hidden, photos] = await Promise.all([
    prisma.profile.findUnique({ where: { id: link.profileId }, include: { preference: true } }),
    loadOptions(),
    hiddenProfileFields(),
    prisma.photo.count({ where: { profileId: link.profileId } }),
  ]);
  if (!profile) notFound();
  const { preference, ...rest } = profile;

  return (
    <main className="mx-auto max-w-4xl px-3 py-5 sm:px-4">
      <div className="mb-5 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-brand-700">{settings?.bureauName}</div>
        <h1 className="mt-1 text-xl font-semibold">Your profile</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Please fill in or correct the details below, add a few photos, and press <strong>Save</strong> at the end. Fields marked * are
          needed. Your phone number and address are only seen by the bureau.
          {contact && <> Questions? Call {contact}.</>}
        </p>
      </div>

      <Card title={`Photos (${photos} of up to ${FAMILY_MAX_PHOTOS})`} className="mb-5">
        <div className="flex items-center gap-4">
          <PhotoUploader profileId={profile.id} upload={uploadFamilyPhoto.bind(null, token)} className="h-24 w-20 shrink-0" />
          <p className="text-sm text-zinc-600">Clear, recent photos help families respond. They are added straight away (no need to press Save).</p>
        </div>
      </Card>

      <ProfileForm
        action={submitFamilyForm.bind(null, token)}
        initial={profileToFormValues(rest, preference)}
        options={options}
        hiddenFields={hidden}
        sections={FAMILY_SECTIONS}
        family
        submitLabel="Save my details"
      />
    </main>
  );
}
