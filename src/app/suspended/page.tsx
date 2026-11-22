import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/tenant/context";

export const metadata = { title: "Service paused" };
export const dynamic = "force-dynamic";

export default async function SuspendedPage() {
  const t = await requireTenant();
  if (t.status !== "SUSPENDED") redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold">{t.name}</h1>
        <p className="mt-3 text-sm text-zinc-600">
          This CRM is paused at the moment. Your data is safe and kept as it is. Please contact your service provider to resume it.
        </p>
      </div>
    </main>
  );
}
