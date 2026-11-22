import { requireOwner } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { BIODATA_SECTIONS, readBiodataOptions } from "@/lib/biodata-options";
import { Alert, Card, Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { saveBiodataSettings } from "../actions";
import { Flash } from "../flash";

export const metadata = { title: "Biodata settings" };

export default async function BiodataSettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireOwner();
  const sp = await searchParams;
  const s = await prisma.settings.findUniqueOrThrow({ where: { id: 1 } });
  const o = readBiodataOptions(s.biodataOptions);

  return (
    <form key={s.updatedAt.toISOString()} action={saveBiodataSettings} className="space-y-5">
      <Flash {...sp} />
      <Alert tone="amber">
        These settings control the biodata image and PDF that staff send (open any profile → Biodata to see the result).
        A biodata always shows the profile code instead of the name, and never the family&apos;s phone or address.
      </Alert>
      <Card title="Look">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Accent colour"><input type="color" name="accentColor" defaultValue={o.accentColor} className="h-10 w-20 rounded border border-zinc-300" /></Field>
          <Field label="Default language">
            <select name="defaultLanguage" defaultValue={o.defaultLanguage} className={inputClass}>
              <option value="en">English</option>
              <option value="pa">Punjabi (Gurmukhi)</option>
            </select>
          </Field>
          <Field label="Header line" hint="e.g. ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ or ॐ, or leave blank"><input name="headerText" defaultValue={o.headerText} className={inputClass} /></Field>
          <Field label="Footer text" hint="e.g. 'Contact the bureau for details'"><input name="footerText" defaultValue={o.footerText} className={inputClass} /></Field>
          <Field label="Name on the biodata" hint="Can be changed each time you share. Phones and addresses are never shown.">
            <select name="showName" defaultValue={o.showName} className={inputClass}>
              <option value="none">Profile code only</option>
              <option value="first">First name</option>
              <option value="full">Full name</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="showBureauContact" defaultChecked={o.showBureauContact} className="size-4 accent-brand-600" />
            Show the bureau&apos;s phone and WhatsApp number on the biodata
          </label>
        </div>
      </Card>
      <Card title="Sections to include">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {Object.entries(BIODATA_SECTIONS).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={`section.${k}`} defaultChecked={o.sections.includes(k as never)} className="size-4 accent-brand-600" />
              {label}
            </label>
          ))}
        </div>
      </Card>
      <SubmitButton>Save biodata settings</SubmitButton>
    </form>
  );
}
