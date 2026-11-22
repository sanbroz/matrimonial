import Link from "next/link";
import { prisma } from "@/lib/db";
import { readFeatures } from "@/lib/features";
import { isEmailConfigured } from "@/lib/services/email";
import { Card } from "./ui";
import { SubmitButton } from "./submit-button";
import { dismissGettingStarted } from "@/lib/actions/onboarding";

/**
 * "Getting started" checklist for a new bureau's owner (dashboard). Only steps for the parts the
 * bureau uses; disappears when every step is done or the owner hides it.
 */
export async function GettingStarted({ whatsappLinked }: { whatsappLinked: boolean }) {
  const s = await prisma.settings.findUniqueOrThrow({
    where: { id: 1 },
    select: { onboardingDone: true, features: true, bureauName: true, logoPath: true, biodataOptions: true, paymentUpi: true, paymentBank: true },
  });
  if (s.onboardingDone) return null;
  const f = readFeatures(s.features);
  const [realProfiles, staff, plans, emailReady] = await Promise.all([
    prisma.profile.count({ where: { isDemo: false } }),
    prisma.user.count({ where: { active: true } }),
    prisma.plan.count({ where: { active: true, isDemo: false } }),
    f.email ? isEmailConfigured() : Promise.resolve(true),
  ]);
  const steps = [
    { done: s.features != null, label: "Choose how much of the CRM to use (Simple, Standard or Advanced)", href: "/settings/features" },
    { done: !!s.logoPath && s.bureauName !== "My Matrimonial Bureau", label: "Add your bureau name, phone and logo", href: "/settings" },
    { done: s.biodataOptions != null, label: "Choose the biodata colour, sections and language", href: "/settings/biodata" },
    { done: realProfiles > 0, label: "Add your first profile (or import your Excel list)", href: "/profiles/new" },
    ...(f.whatsapp ? [{ done: whatsappLinked, label: "Link the bureau's WhatsApp number", href: "/settings/whatsapp" }] : []),
    ...(f.email ? [{ done: emailReady, label: "Set up email (Gmail)", href: "/settings/email" }] : []),
    ...(f.payments ? [{ done: plans > 0 && !!(s.paymentUpi || s.paymentBank), label: "Add membership plans and your payment details", href: "/settings/plans" }] : []),
    { done: staff > 1, label: "Add your staff (optional)", href: "/settings/staff" },
  ];
  const done = steps.filter((x) => x.done).length;
  if (done === steps.length) return null;

  return (
    <Card
      title={`Getting started (${done} of ${steps.length} done)`}
      className="mb-5 border-brand-200"
      actions={
        <form action={dismissGettingStarted}>
          <SubmitButton variant="ghost" pendingText="…">Hide</SubmitButton>
        </form>
      }
    >
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.round((done / steps.length) * 100)}%` }} />
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {steps.map((x) => (
          <li key={x.label} className="flex items-start gap-2 text-sm">
            <span className={x.done ? "text-emerald-600" : "text-zinc-300"}>{x.done ? "✓" : "○"}</span>
            {x.done ? (
              <span className="text-zinc-500 line-through">{x.label}</span>
            ) : (
              <Link href={x.href} className="text-brand-700 hover:underline">{x.label}</Link>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
