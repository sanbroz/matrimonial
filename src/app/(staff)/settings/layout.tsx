import { requireOwner } from "@/lib/auth/server";
import { PageHeader } from "@/components/ui";
import { SettingsTabs } from "./tabs";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return (
    <>
      <PageHeader title="Settings" subtitle="Only the owner can see and change these." />
      <SettingsTabs />
      {children}
    </>
  );
}
