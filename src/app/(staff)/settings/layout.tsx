import { requireOwner } from "@/lib/auth/server";
import { PageHeader } from "@/components/ui";
import { SettingsTabs } from "./tabs";
import { bureauFeatures } from "@/lib/services/workflow";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  const f = await bureauFeatures();
  const hide = [!f.payments && "/settings/plans", !f.email && "/settings/email", !f.whatsapp && "/settings/whatsapp"].filter(Boolean) as string[];
  return (
    <>
      <PageHeader title="Settings" subtitle="Only the owner can see and change these." />
      <SettingsTabs hide={hide} />
      {children}
    </>
  );
}
