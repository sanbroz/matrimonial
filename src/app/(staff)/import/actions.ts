"use server";

import ExcelJS from "exceljs";
import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/server";
import { isBlankRow, mapRow } from "@/lib/import-mapping";
import { phoneKey } from "@/lib/parse";
import { createProfile, existingPhoneIndex } from "@/lib/services/profiles";

const MAX_ROWS = 5000;

export type ParsedSheet = { fileName: string; headers: string[]; rows: string[][]; error?: string };

export async function parseImportFile(fd: FormData): Promise<ParsedSheet> {
  await requireUser();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { fileName: "", headers: [], rows: [], error: "Choose a file first." };
  const name = file.name;
  const lower = name.toLowerCase();
  try {
    let table: string[][];
    if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
      const text = (await file.text()).replace(/^﻿/, "");
      const res = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
      table = res.data.map((r) => r.map((c) => String(c ?? "")));
    } else if (lower.endsWith(".xlsx")) {
      table = await readXlsx(await file.arrayBuffer());
    } else {
      return { fileName: name, headers: [], rows: [], error: "Use an Excel .xlsx or .csv file. (For old .xls files, open in Excel and 'Save As' .xlsx.)" };
    }
    // First non-empty row is the header
    while (table.length && isBlankRow(table[0])) table.shift();
    if (table.length < 2) return { fileName: name, headers: [], rows: [], error: "The file has no data rows below the header." };
    const headers = table[0].map((h, i) => h.trim() || `Column ${i + 1}`);
    const rows = table.slice(1, MAX_ROWS + 1).map((r) => headers.map((_, i) => r[i] ?? ""));
    return {
      fileName: name,
      headers,
      rows,
      error: table.length - 1 > MAX_ROWS ? `Only the first ${MAX_ROWS} rows were loaded. Split the file and import the rest separately.` : undefined,
    };
  } catch (e) {
    console.error("import parse failed", e);
    return { fileName: name, headers: [], rows: [], error: "Could not read this file. Is it a valid Excel/CSV file?" };
  }
}

async function readXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets.find((w) => w.actualRowCount > 0);
  if (!ws) return [];
  const out: string[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const cells: string[] = [];
    for (let c = 1; c <= ws.columnCount; c++) cells.push(cellText(row.getCell(c).value));
    out.push(cells);
  });
  return out;
}

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) {
    // Excel dates have no timezone; ExcelJS gives them as UTC.
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v && typeof v.text === "string") return v.text;
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
    if ("error" in v) return "";
  }
  return String(v);
}

// ───────────── Run import ─────────────

const runSchema = z.object({
  fileName: z.string().max(200),
  mapping: z.array(z.string().nullable()),
  rows: z.array(z.array(z.string())).max(MAX_ROWS),
  defaultGender: z.enum(["MALE", "FEMALE", ""]),
  duplicates: z.enum(["skip", "import"]),
});

export type ImportResult = {
  created: { rowNumber: number; code: string; name: string }[];
  skipped: { rowNumber: number; reason: string }[];
};

export async function runImport(input: z.infer<typeof runSchema>): Promise<ImportResult> {
  const user = await requireUser();
  const { fileName, mapping, rows, defaultGender, duplicates } = runSchema.parse(input);
  const phones = await existingPhoneIndex();
  const result: ImportResult = { created: [], skipped: [] };
  const source = `${fileName} (${new Date().toISOString().slice(0, 10)})`;

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2;
    if (isBlankRow(rows[i])) continue;
    const r = mapRow(rows[i], mapping, rowNumber, { gender: defaultGender });
    if (r.errors.length) {
      result.skipped.push({ rowNumber, reason: r.errors.join("; ") });
      continue;
    }
    const keys = [phoneKey(r.profile.phone as string), phoneKey(r.profile.altPhone as string)].filter(Boolean) as string[];
    const dupOf = keys.map((k) => phones.get(k)).find(Boolean);
    if (dupOf && duplicates === "skip") {
      result.skipped.push({ rowNumber, reason: `Phone already on profile ${dupOf}` });
      continue;
    }
    try {
      const p = await createProfile(r.profile, r.preference, user.id, { importedFrom: source });
      for (const k of keys) phones.set(k, p.code); // catch duplicates within the same file
      result.created.push({ rowNumber, code: p.code, name: p.fullName });
    } catch (e) {
      console.error("import row failed", rowNumber, e);
      result.skipped.push({ rowNumber, reason: "Could not be saved (unexpected error)" });
    }
  }
  revalidatePath("/profiles");
  return result;
}
