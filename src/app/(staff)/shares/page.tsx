import Link from "next/link";
import { requireUser } from "@/lib/auth/server";
import { requireTenant } from "@/lib/tenant/context";
import { tenantBaseUrl } from "@/lib/tenant/registry";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { LAYOUTS, type Layout } from "@/lib/share";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { CopyButton } from "@/components/small-client";
import { Flash } from "../settings/flash";
import { revokeShareLink } from "../share/actions";

export const metadata = { title: "Share links" };

export default async function ShareLinksPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireUser();
  const tenant = await requireTenant();
  const sp = await searchParams;
  const [links, base, users] = await Promise.all([
    prisma.shareLink.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    tenantBaseUrl(tenant),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);
  const clientIds = [...new Set(links.map((l) => l.forProfileId).filter((x): x is string => !!x))];
  const allIds = [...new Set(links.flatMap((l) => l.profileIds))];
  const [clients, profiles] = await Promise.all([
    prisma.profile.findMany({ where: { id: { in: clientIds } }, select: { id: true, code: true, fullName: true } }),
    prisma.profile.findMany({ where: { id: { in: allIds } }, select: { id: true, code: true } }),
  ]);
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const codeById = new Map(profiles.map((p) => [p.id, p.code]));
  const userById = new Map(users.map((u) => [u.id, u.name]));
  const now = new Date();

  return (
    <>
      <PageHeader title="Share links" subtitle="Links to biodatas that families can open without signing in. Switch a link off at any time." />
      <Flash {...sp} />
      {links.length === 0 ? (
        <EmptyState>
          No links yet. Select profiles in <Link href="/profiles" className="text-brand-700 underline">Profiles</Link> or on a family&apos;s suggested
          matches and click <strong>Share selected</strong>.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
              <tr>
                <th className="px-3 py-2">Link</th>
                <th className="px-3 py-2">Profiles</th>
                <th className="hidden px-3 py-2 md:table-cell">Created</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {links.map((l) => {
                const client = l.forProfileId ? clientById.get(l.forProfileId) : null;
                const active = !l.revokedAt && l.expiresAt > now;
                const url = `${base}/s/${l.token}`;
                const q = new URLSearchParams();
                l.profileIds.forEach((id) => q.append("id", id));
                if (l.forProfileId) q.set("for", l.forProfileId);
                q.set("layout", l.layout);
                q.set("lang", l.lang);
                q.set("name", l.nameMode);
                l.sections.forEach((s) => q.append("sections", s));
                return (
                  <tr key={l.id} className="align-top">
                    <td className="px-3 py-2">
                      <div className="font-medium">{l.title || (client ? `For ${client.code}` : `${l.profileIds.length} profiles`)}</div>
                      {client && (
                        <Link href={`/profiles/${client.id}`} className="text-xs text-brand-700 hover:underline">{client.code} · {client.fullName}</Link>
                      )}
                      <div className="text-xs text-zinc-500">
                        {LAYOUTS[l.layout as Layout]?.label ?? l.layout} · {l.lang === "pa" ? "Punjabi" : "English"} · {l.sections.length} sections
                      </div>
                    </td>
                    <td className="max-w-[260px] px-3 py-2 font-mono text-xs text-zinc-700">
                      {l.profileIds.map((id) => codeById.get(id) ?? "(deleted)").join(", ")}
                    </td>
                    <td className="hidden px-3 py-2 text-xs text-zinc-600 md:table-cell">
                      {formatDateTime(l.createdAt)}
                      <div className="text-zinc-400">by {userById.get(l.createdById) ?? "—"}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {l.revokedAt ? <Badge tone="zinc">switched off</Badge> : active ? <Badge tone="green">active</Badge> : <Badge tone="amber">expired</Badge>}
                      <div className="mt-1 text-zinc-500">
                        {active ? `until ${formatDateTime(l.expiresAt)}` : ""}
                        <br />
                        {l.views} view{l.views === 1 ? "" : "s"}
                        {l.lastViewedAt ? `, last ${formatDateTime(l.lastViewedAt)}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap justify-end gap-1">
                        {active && <CopyButton text={url} label="Copy" />}
                        <Link href={`/share?${q}`} className="rounded-md px-2.5 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100">Share again</Link>
                        {active && (
                          <form action={revokeShareLink}>
                            <input type="hidden" name="linkId" value={l.id} />
                            <SubmitButton variant="ghost" pendingText="…" confirm="Switch this link off? People who have it can no longer open it.">Switch off</SubmitButton>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
