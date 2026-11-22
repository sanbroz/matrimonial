import "server-only";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { MARITAL_LABELS, visibleFields } from "@/lib/profile-fields";
import { SOURCE_LABELS } from "@/lib/lead-labels";
import { hiddenProfileFields } from "./workflow";

const istDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

/** Excel cells must not start with = + - @ (spreadsheet formula injection). */
const safe = (v: unknown): string | number => {
  if (v == null) return "";
  if (typeof v === "number") return v;
  const s = v instanceof Date ? istDate(v) : Array.isArray(v) ? v.join(", ") : String(v);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
};

function sheet(wb: ExcelJS.Workbook, name: string, headers: string[], rows: (string | number)[][]) {
  const ws = wb.addWorksheet(name);
  ws.addRow(headers).font = { bold: true };
  rows.forEach((r) => ws.addRow(r));
  ws.columns.forEach((c, i) => (c.width = Math.min(40, Math.max(10, headers[i].length + 2))));
  ws.views = [{ state: "frozen", ySplit: 1 }];
  return ws;
}

/** All profiles with the fields the bureau uses (the same columns import understands). */
export async function profilesWorkbook(): Promise<Buffer> {
  const hidden = await hiddenProfileFields();
  const fields = visibleFields(hidden).filter((f) => !f.pref);
  const profiles = await prisma.profile.findMany({ orderBy: { code: "asc" }, where: { isDemo: false } });
  const wb = new ExcelJS.Workbook();
  sheet(
    wb,
    "Profiles",
    ["Profile code", "Status", ...fields.map((f) => f.label), "Added on"],
    profiles.map((p) => {
      const rec = p as unknown as Record<string, unknown>;
      return [
        p.code,
        p.status,
        ...fields.map((f) => {
          const v = rec[f.key];
          if (f.type === "gender") return v === "MALE" ? "Male" : v === "FEMALE" ? "Female" : "";
          if (f.type === "marital") return MARITAL_LABELS[v as keyof typeof MARITAL_LABELS] ?? "";
          if (f.type === "date") return istDate(v as Date | null);
          if (f.type === "bool") return v ? "Yes" : "";
          return safe(v);
        }),
        istDate(p.createdAt),
      ];
    }),
  );
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function leadsWorkbook(): Promise<Buffer> {
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    where: { isDemo: false },
    include: { leadForm: { select: { name: true } }, profile: { select: { code: true } } },
  });
  const wb = new ExcelJS.Workbook();
  sheet(
    wb,
    "Leads",
    ["Name", "Phone", "Other phone", "For", "City", "Source", "Came in through", "Status", "Lost reason", "Profile code", "Details", "Added on"],
    leads.map((l) => [
      safe(l.name), safe(l.phone), safe(l.altPhone), safe(l.forWhom), safe(l.city), SOURCE_LABELS[l.source], safe(l.leadForm?.name),
      l.status, safe(l.lostReason), l.profile?.code ?? "", safe(l.details), istDate(l.createdAt),
    ]),
  );
  return Buffer.from(await wb.xlsx.writeBuffer());
}

