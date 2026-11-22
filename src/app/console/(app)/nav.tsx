"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const LINKS = [
  { href: "/", label: "Bureaus" },
  { href: "/backups", label: "Backups" },
  { href: "/updates", label: "Updates" },
  { href: "/settings", label: "Settings" },
];

export function ConsoleNav() {
  const path = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 px-2 pb-2 md:flex-col md:flex-nowrap md:px-3">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" || path.startsWith("/tenants") : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cx(
              "whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium",
              active ? "bg-white/10 text-white" : "text-zinc-300 hover:bg-white/5 hover:text-white",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
