"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const TABS = [
  { href: "/settings", label: "Bureau" },
  { href: "/settings/biodata", label: "Biodata" },
  { href: "/settings/matching", label: "Matching" },
  { href: "/settings/plans", label: "Plans" },
  { href: "/settings/staff", label: "Staff" },
  { href: "/settings/fields", label: "Fields" },
  { href: "/settings/lists", label: "Lists" },
  { href: "/settings/email", label: "Email" },
  { href: "/settings/whatsapp", label: "WhatsApp" },
  { href: "/settings/messages", label: "Messages" },
  { href: "/settings/backups", label: "Backups" },
  { href: "/settings/demo", label: "Demo data" },
];

export function SettingsTabs() {
  const path = usePathname();
  return (
    // Wraps onto a second line when there are many tabs (no hidden overflow, no scrollbar)
    <div className="mb-5 flex flex-wrap gap-x-1 border-b border-zinc-200">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cx(
            "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
            path === t.href ? "border-brand-600 text-brand-700" : "border-transparent text-zinc-600 hover:text-zinc-900",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
