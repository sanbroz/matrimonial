import { PageHeader } from "@/components/ui";
import { platformDomain } from "@/lib/tenant/host";
import { NewTenantForm } from "./form";

export const metadata = { title: "Add bureau" };

export default function NewTenantPage() {
  return (
    <>
      <PageHeader title="Add bureau" subtitle="Creates its own separate database, file storage and owner login" />
      <NewTenantForm domain={platformDomain()} />
    </>
  );
}
