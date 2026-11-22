import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { loadOptions } from "@/lib/services/profiles";
import { hiddenProfileFields } from "@/lib/services/workflow";
import { profileToFormValues } from "@/lib/profile-form-values";
import { PageHeader } from "@/components/ui";
import { ProfileForm } from "../../profile-form";
import { updateProfileAction } from "../../actions";

export const metadata = { title: "Edit profile" };

export default async function EditProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const [profile, options] = await Promise.all([
    prisma.profile.findUnique({ where: { id }, include: { preference: true } }),
    loadOptions(),
  ]);
  if (!profile) notFound();
  const { preference, ...rest } = profile;

  return (
    <>
      <PageHeader title={`Edit ${profile.code}`} subtitle={profile.fullName} />
      <ProfileForm
        action={updateProfileAction.bind(null, profile.id)}
        initial={profileToFormValues(rest, preference)}
        options={options}
        cancelHref={`/profiles/${profile.id}`}
        hiddenFields={await hiddenProfileFields()}
        submitLabel="Save changes"
      />
    </>
  );
}
