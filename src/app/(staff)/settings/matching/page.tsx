import { requireOwner } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { readMatchingOptions } from "@/lib/matching";
import { Card } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { saveMatchingSettings } from "../actions";
import { Flash } from "../flash";

export const metadata = { title: "Matching rules" };

export default async function MatchingSettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireOwner();
  const sp = await searchParams;
  const s = await prisma.settings.findUniqueOrThrow({ where: { id: 1 }, select: { matchingOptions: true } });
  const o = readMatchingOptions(s.matchingOptions);

  const check = (name: keyof typeof o, label: string, hint: string) => (
    <label className="flex gap-3 text-sm">
      <input type="checkbox" name={name} defaultChecked={o[name] === true} className="mt-0.5 size-4 shrink-0 accent-brand-600" />
      <span>
        <span className="font-medium">{label}</span>
        <span className="block text-xs text-zinc-500">{hint}</span>
      </span>
    </label>
  );

  return (
    <form action={saveMatchingSettings} className="space-y-5">
      <Flash {...sp} />
      <Card title="Gotra rule">
        <p className="mb-3 text-sm text-zinc-600">Applied only when both profiles have a gotra recorded, so it never affects families who don&apos;t follow it.</p>
        <div className="space-y-2 text-sm">
          {[
            ["all", "Avoid all recorded gotras", "Rule out a match if any of self / mother / dadi gotras is the same on both sides"],
            ["self", "Avoid own gotra only", "Rule out only when the two candidates have the same gotra"],
            ["off", "Don't check gotra", ""],
          ].map(([v, l, h]) => (
            <label key={v} className="flex gap-3">
              <input type="radio" name="gotraRule" value={v} defaultChecked={o.gotraRule === v} className="mt-0.5 size-4 shrink-0 accent-brand-600" />
              <span><span className="font-medium">{l}</span>{h && <span className="block text-xs text-zinc-500">{h}</span>}</span>
            </label>
          ))}
        </div>
      </Card>
      <Card title="Preferences">
        <div className="space-y-3">
          {check("twoWay", "Check preferences both ways", "Only suggest people whose own preferences the client also meets (recommended)")}
          {check("strictCastes", "Preferred castes are a must", "Off: other castes are still suggested, just ranked lower. 'Caste no bar' on a profile always allows all castes.")}
          {check("strictCountries", "Preferred countries are a must", "Off: other countries are still suggested, just ranked lower")}
          {check("includeOnHold", "Include on-hold profiles", "Also suggest profiles whose status is 'On hold'")}
        </div>
        <p className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
          Always must-haves when set on a profile: age range, height range, religions, castes to exclude and acceptable marital status.
          Education and income preferences compare positions in the Education and Annual income dropdown lists,
          so keep those lists ordered from lowest to highest (Settings → Dropdown lists).
        </p>
      </Card>
      <SubmitButton>Save matching rules</SubmitButton>
    </form>
  );
}
