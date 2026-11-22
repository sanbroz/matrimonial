import { requireOwner } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { LOCKED_FIELDS, PROFILE_FIELDS, SECTIONS, inputName } from "@/lib/profile-fields";
import { Card } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { Flash } from "../flash";
import { saveFieldSettings } from "../actions";

export const metadata = { title: "Profile fields" };

export default async function FieldsSettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireOwner();
  const sp = await searchParams;
  const s = await prisma.settings.findUniqueOrThrow({ where: { id: 1 }, select: { hiddenFields: true, updatedAt: true } });
  const hidden = new Set(s.hiddenFields);

  return (
    <form key={s.updatedAt.toISOString()} action={saveFieldSettings} className="space-y-5">
      <Flash {...sp} />
      <p className="text-sm text-zinc-600">
        Untick the fields your bureau doesn&apos;t use. They disappear from the profile form and the family&apos;s self-fill form.
        Anything already saved in them is kept (tick the field again to see it). Name, gender, date of birth and phone are always used.
      </p>
      {SECTIONS.map((sec) => {
        const fields = PROFILE_FIELDS.filter((f) => f.section === sec.key);
        return (
          <Card key={sec.key} title={sec.title}>
            <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map((f) => {
                const name = inputName(f);
                const locked = LOCKED_FIELDS.includes(name);
                return (
                  <label key={name} className={locked ? "flex items-center gap-2 text-sm text-zinc-400" : "flex items-center gap-2 text-sm"}>
                    <input
                      type="checkbox"
                      name="use"
                      value={name}
                      defaultChecked={locked || !hidden.has(name)}
                      disabled={locked}
                      className="size-4 accent-brand-600"
                    />
                    {f.label}
                    {locked && <span className="text-xs">(always)</span>}
                  </label>
                );
              })}
            </div>
          </Card>
        );
      })}
      <div className="sticky bottom-0 -mx-4 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-lg md:border">
        <SubmitButton>Save fields</SubmitButton>
      </div>
    </form>
  );
}
