import Link from "next/link";
import { requireOwner } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { OPTION_CATEGORIES, type OptionCategory } from "@/lib/options-defaults";
import { Card, cx, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { saveOptionList } from "../actions";
import { Flash } from "../flash";

export const metadata = { title: "Dropdown lists" };

export default async function ListsPage({ searchParams }: { searchParams: Promise<{ cat?: string; ok?: string; error?: string }> }) {
  await requireOwner();
  const sp = await searchParams;
  const cat = (sp.cat && sp.cat in OPTION_CATEGORIES ? sp.cat : "religion") as OptionCategory;
  const [items, counts] = await Promise.all([
    prisma.optionItem.findMany({ where: { category: cat }, orderBy: [{ sortOrder: "asc" }, { value: "asc" }] }),
    prisma.optionItem.groupBy({ by: ["category"], _count: true }),
  ]);
  const countOf = (c: string) => counts.find((x) => x.category === c)?._count ?? 0;

  return (
    <div className="grid gap-5 md:grid-cols-[14rem_1fr]">
      <nav className="flex flex-wrap gap-1 md:flex-col">
        {Object.entries(OPTION_CATEGORIES).map(([k, label]) => (
          <Link
            key={k}
            href={`/settings/lists?cat=${k}`}
            className={cx("flex justify-between gap-2 rounded-md px-3 py-1.5 text-sm", k === cat ? "bg-brand-50 text-brand-700" : "text-zinc-700 hover:bg-zinc-100")}
          >
            {label} <span className="text-xs text-zinc-400">{countOf(k)}</span>
          </Link>
        ))}
      </nav>
      <div>
        <Flash ok={sp.ok} error={sp.error} />
        <Card title={OPTION_CATEGORIES[cat]}>
          <p className="mb-3 text-sm text-zinc-600">
            One value per line, in the order you want them shown. These are suggestions. Staff can still type a value that isn&apos;t
            in the list, and removing a value here doesn&apos;t change existing profiles.
          </p>
          {(cat === "education" || cat === "annualIncome") && (
            <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Keep this list ordered from <strong>lowest to highest</strong>. Match suggestions use the order to judge
              &quot;at least&quot; preferences (e.g. minimum education). &quot;Other&quot; is never compared.
            </p>
          )}
          {/* key: a fresh form per category, so the text box shows that category's values
              (otherwise React keeps the previous category's textarea when switching) */}
          <form key={cat} action={saveOptionList} className="space-y-3">
            <input type="hidden" name="category" value={cat} />
            <textarea name="values" rows={16} defaultValue={items.map((i) => i.value).join("\n")} className={inputClass + " font-mono"} />
            <SubmitButton>Save list</SubmitButton>
          </form>
        </Card>
      </div>
    </div>
  );
}
