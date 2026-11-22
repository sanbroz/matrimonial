"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const TABS = [
  { href: "/settings", label: "Bureau & fees" },
  { href: "/settings/biodata", label: "Biodata" },
  { href: "/settings/matching", label: "Matching rules" },
  { href: "/settings/plans", label: "Membership plans" },
  { href: "/settings/staff", label: "Staff" },
  { href: "/settings/lists", label: "Dropdown lists" },
  { href: "/settings/email", label: "Email" },
  { href: "/settings/whatsapp", label: "WhatsApp" },
  { href: "/settings/messages", label: "Message templates" },
];

export function SettingsTabs() {
  const path = usePathname();
  return (
    // overflow-y-hidden: the tabs' -1px underline overlap otherwise makes Windows draw a vertical scrollbar
    <div className="no-scrollbar mb-5 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-zinc-200">
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
