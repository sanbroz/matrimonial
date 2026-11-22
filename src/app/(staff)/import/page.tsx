import { requireUser } from "@/lib/auth/server";
import { PageHeader } from "@/components/ui";
import { ImportWizard } from "./import-wizard";

export const metadata = { title: "Import" };

export default async function ImportPage() {
  await requireUser();
  return (
    <>
      <PageHeader title="Import profiles" subtitle="Bring in existing records from an Excel sheet or CSV. Each row becomes a new profile with its own code." />
      <ImportWizard />
    </>
  );
}
