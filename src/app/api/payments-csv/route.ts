import Papa from "papaparse";
import { getCurrentUser } from "@/lib/auth/server";
import { collections, currentMonth } from "@/lib/services/reports";
import { KIND_LABELS, MODE_LABELS } from "@/lib/money";

/** Owner only: one month's receipts as CSV (opens in Excel). */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  if (user.role !== "OWNER") return new Response("Owner only", { status: 403 });

  const param = new URL(req.url).searchParams.get("month") ?? "";
  const month = /^\d{4}-\d{2}$/.test(param) ? param : currentMonth();
  const rows = (await collections(month)).map((p) => ({
    "Receipt no": p.receiptNo,
    Date: p.paidAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    "Profile code": p.profileCode,
    "Received from": p.payerName,
    Type: KIND_LABELS[p.kind],
    For: p.description,
    Mode: MODE_LABELS[p.mode],
    Reference: p.reference ?? "",
    Amount: p.voidedAt ? 0 : p.amount,
    Void: p.voidedAt ? `VOID: ${p.voidReason ?? ""}` : "",
    "Recorded by": p.createdBy.name,
  }));
  const fields = ["Receipt no", "Date", "Profile code", "Received from", "Type", "For", "Mode", "Reference", "Amount", "Void", "Recorded by"];
  // Explicit fields so an empty month still gets a header row
  const csv = "﻿" + Papa.unparse({ fields, data: rows.map((r) => fields.map((f) => r[f as keyof typeof r])) });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="collections-${month}.csv"`,
    },
  });
}
