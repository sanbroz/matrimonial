"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

type Gate = "pipeline" | "payments" | "reports";
const LINKS: { href: string; label: string; feature?: Gate; owner?: boolean; perm?: "payments" | "reports" }[] = [
  { href: "/", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
  { href: "/profiles", label: "Profiles" },
  { href: "/pipeline", label: "Pipeline", feature: "pipeline" },
  { href: "/payments", label: "Payments", feature: "payments", perm: "payments" },
  { href: "/reports", label: "Reports", feature: "reports", perm: "reports" },
  { href: "/settings", label: "Settings", owner: true },
];

export function NavLinks({ isOwner, features, can }: { isOwner: boolean; features: Record<Gate, boolean>; can: Record<"payments" | "reports", boolean> }) {
  const path = usePathname();
  const links = LINKS.filter((l) => (!l.owner || isOwner) && (!l.feature || features[l.feature]) && (!l.perm || can[l.perm]));
  return (
    // Phones: wraps onto a second line (nothing hidden off-screen). Desktop: a column.
    <nav className="flex flex-wrap gap-1 px-2 pb-2 md:flex-col md:flex-nowrap md:px-3">
      {links.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cx(
              "whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium",
              active ? "bg-brand-50 text-brand-700" : "text-zinc-700 hover:bg-zinc-100",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
