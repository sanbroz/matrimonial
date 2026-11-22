import { getCurrentUser } from "@/lib/auth/server";
import { bureauFeatures } from "@/lib/services/workflow";
import { leadsWorkbook } from "@/lib/services/export";
import { todayIST } from "@/lib/money";

export const dynamic = "force-dynamic";

/** Owner only (contains phone numbers): all leads as an Excel file. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  if (user.role !== "OWNER") return new Response("Owner only", { status: 403 });
  if (!(await bureauFeatures()).reports) return new Response("Reports & export is switched off (Settings → Features)", { status: 403 });
  const file = await leadsWorkbook();
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="leads-${todayIST().toISOString().slice(0, 10)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
