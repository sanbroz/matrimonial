"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
  { href: "/profiles", label: "Profiles" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/payments", label: "Payments" },
];

const OWNER_LINKS = [{ href: "/settings", label: "Settings" }];

export function NavLinks({ isOwner }: { isOwner: boolean }) {
  const path = usePathname();
  const links = isOwner ? [...LINKS, ...OWNER_LINKS] : LINKS;
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
