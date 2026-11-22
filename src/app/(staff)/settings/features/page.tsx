import { requireOwner } from "@/lib/auth/server";
import { FEATURES, PRESETS, presetOf, type Feature } from "@/lib/features";
import { bureauFeatures } from "@/lib/services/workflow";
import { Card, cx } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { Flash } from "../flash";
import { applyFeaturePreset, saveFeatures } from "../actions";

export const metadata = { title: "Features" };

export default async function FeaturesPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireOwner();
  const sp = await searchParams;
  const f = await bureauFeatures();
  const current = presetOf(f, f.trackMeetings);

  return (
    <div className="space-y-5">
      <Flash {...sp} />
      <Card title="How much of the CRM do you want to use?">
        <p className="mb-3 text-sm text-zinc-600">
          Pick a setup to start with. You can switch single parts on or off below at any time; nothing you entered is deleted when
          a part is switched off.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.entries(PRESETS).map(([k, p]) => (
            <form key={k} action={applyFeaturePreset}>
              <input type="hidden" name="preset" value={k} />
              <button
                className={cx(
                  "h-full w-full rounded-lg border p-3 text-left transition hover:border-brand-300",
                  current === k ? "border-brand-500 bg-brand-50" : "border-zinc-200 bg-white",
                )}
              >
                <span className="flex items-center justify-between font-semibold">
                  {p.label}
                  {current === k && <span className="text-xs font-medium text-brand-700">in use</span>}
                </span>
                <span className="mt-1 block text-xs text-zinc-600">{p.hint}</span>
              </button>
            </form>
          ))}
        </div>
      </Card>

      <form action={saveFeatures}>
        <Card title="Parts of the CRM">
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(FEATURES) as Feature[]).map((k) => (
              <label key={k} className="flex items-start gap-3 rounded-md border border-zinc-200 p-3 text-sm">
                <input type="checkbox" name={k} defaultChecked={f[k]} className="mt-0.5 size-4 accent-brand-600" />
                <span>
                  <span className="font-medium">{FEATURES[k].label}</span>
                  <span className="block text-xs text-zinc-500">{FEATURES[k].hint}</span>
                </span>
              </label>
            ))}
            <label className="flex items-start gap-3 rounded-md border border-zinc-200 p-3 text-sm">
              <input type="checkbox" name="trackMeetings" defaultChecked={f.trackMeetings} className="mt-0.5 size-4 accent-brand-600" />
              <span>
                <span className="font-medium">Meetings between families</span>
                <span className="block text-xs text-zinc-500">&quot;Meeting scheduled&quot; and &quot;Met&quot; stages in the pipeline, with dates and reminders</span>
              </span>
            </label>
          </div>
          <div className="mt-4"><SubmitButton>Save</SubmitButton></div>
        </Card>
      </form>
    </div>
  );
}
