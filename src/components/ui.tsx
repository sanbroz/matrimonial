import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export const inputClass =
  "block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-zinc-100";

export const buttonClass = {
  primary:
    "inline-flex items-center justify-center gap-1.5 rounded-md bg-brand-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-60",
  danger:
    "inline-flex items-center justify-center gap-1.5 rounded-md border border-red-200 bg-white px-3.5 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60",
  ghost:
    "inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100",
};

export function ButtonLink({
  variant = "secondary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof buttonClass }) {
  return <Link {...props} className={cx(buttonClass[variant], className)} />;
}

export function Card({ children, className, title, actions }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={cx("rounded-lg border border-zinc-200 bg-white shadow-sm", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, error, hint, children, className }: { label: ReactNode; error?: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

const badgeTones = {
  zinc: "bg-zinc-100 text-zinc-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-800",
  red: "bg-red-50 text-red-700",
  blue: "bg-sky-50 text-sky-700",
  brand: "bg-brand-50 text-brand-700",
};

export function Badge({ children, tone = "zinc" }: { children: ReactNode; tone?: keyof typeof badgeTones }) {
  return <span className={cx("inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium", badgeTones[tone])}>{children}</span>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500">{children}</div>;
}

export function Alert({ children, tone = "red" }: { children: ReactNode; tone?: "red" | "green" | "amber" }) {
  const t = { red: "border-red-200 bg-red-50 text-red-800", green: "border-emerald-200 bg-emerald-50 text-emerald-800", amber: "border-amber-200 bg-amber-50 text-amber-900" }[tone];
  return <div className={cx("rounded-md border px-3 py-2 text-sm", t)}>{children}</div>;
}

export function DL({ items }: { items: [ReactNode, ReactNode][] }) {
  const shown = items.filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (shown.length === 0) return <p className="text-sm text-zinc-400">Nothing recorded.</p>;
  // Container queries: columns follow the CARD's width, not the screen's,
  // so the same list works in the wide main column and the narrow sidebar.
  return (
    <div className="@container">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 @2xl:grid-cols-2">
        {shown.map(([k, v], i) => (
          <div key={i} className="flex flex-col text-sm @xs:flex-row @xs:gap-3">
            <dt className="text-zinc-500 @xs:w-36 @xs:shrink-0">{k}</dt>
            <dd className="min-w-0 break-words text-zinc-900">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
