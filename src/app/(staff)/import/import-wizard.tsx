"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { SECTIONS, inputName } from "@/lib/profile-fields";
import { IMPORTABLE_FIELDS, guessMapping, isBlankRow, mapRow } from "@/lib/import-mapping";
import { Alert, Badge, Card, Field, buttonClass, cx, inputClass } from "@/components/ui";
import { parseImportFile, runImport, type ImportResult, type ParsedSheet } from "./actions";

const PREVIEW_ROWS = 20;

export function ImportWizard() {
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<(string | null)[]>([]);
  const [defaultGender, setDefaultGender] = useState<"" | "MALE" | "FEMALE">("");
  const [duplicates, setDuplicates] = useState<"skip" | "import">("skip");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();

  const dataRows = useMemo(() => (sheet ? sheet.rows.map((r, i) => ({ r, i })).filter(({ r }) => !isBlankRow(r)) : []), [sheet]);
  const checked = useMemo(
    () => (sheet ? dataRows.map(({ r, i }) => mapRow(r, mapping, i + 2, { gender: defaultGender })) : []),
    [sheet, dataRows, mapping, defaultGender],
  );
  const okCount = checked.filter((c) => c.errors.length === 0).length;
  const mapped = new Set(mapping.filter(Boolean));
  const hasName = mapped.has("fullName");
  const hasGender = mapped.has("gender") || defaultGender !== "";

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    e.target.value = ""; // so choosing the same (corrected) file again triggers a new read
    setResult(null);
    start(async () => {
      const s = await parseImportFile(fd);
      setSheet(s);
      setMapping(guessMapping(s.headers));
    });
  }

  function doImport() {
    if (!sheet) return;
    start(async () => {
      const res = await runImport({ fileName: sheet.fileName, mapping, rows: sheet.rows, defaultGender, duplicates });
      setResult(res);
    });
  }

  if (result) {
    return (
      <div className="space-y-4">
        <Alert tone="green">
          Imported {result.created.length} profile{result.created.length === 1 ? "" : "s"}
          {result.skipped.length > 0 && `, skipped ${result.skipped.length}`}.
        </Alert>
        {result.skipped.length > 0 && (
          <Card title="Skipped rows (fix them in the file and import just those rows again)">
            <ul className="max-h-80 space-y-1 overflow-y-auto text-sm">
              {result.skipped.map((s) => (
                <li key={s.rowNumber}><span className="font-mono text-zinc-500">Row {s.rowNumber}:</span> {s.reason}</li>
              ))}
            </ul>
          </Card>
        )}
        {result.created.length > 0 && (
          <Card title="Created">
            <ul className="grid max-h-80 grid-cols-1 gap-1 overflow-y-auto text-sm sm:grid-cols-2">
              {result.created.map((c) => (
                <li key={c.code}><span className="font-mono text-brand-700">{c.code}</span> {c.name} <span className="text-zinc-400">(row {c.rowNumber})</span></li>
              ))}
            </ul>
          </Card>
        )}
        <div className="flex gap-2">
          <Link href="/profiles" className={buttonClass.primary}>Go to profiles</Link>
          <button className={buttonClass.secondary} onClick={() => { setSheet(null); setResult(null); }}>Import another file</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card title="1. Choose file">
        <div className="flex flex-wrap items-center gap-3">
          <input type="file" accept=".xlsx,.csv" onChange={onFile} disabled={pending} className="text-sm" />
          <a href="/api/import-template" className="text-sm text-brand-700 underline">Download a blank template (CSV)</a>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Excel (.xlsx) or CSV. The first row must hold the column names. Dates are read day-first (15/08/1995). Heights can
          be 5&apos;6&quot;, 5.6, 5-6 or 168 cm.
        </p>
        {pending && !sheet && <p className="mt-2 text-sm text-zinc-500">Reading file…</p>}
        {sheet?.error && <div className="mt-3"><Alert tone={sheet.rows.length ? "amber" : "red"}>{sheet.error}</Alert></div>}
      </Card>

      {sheet && sheet.rows.length > 0 && (
        <>
          <Card title={`2. Match columns (${sheet.headers.length} columns, ${dataRows.length} rows in ${sheet.fileName})`}>
            <p className="mb-3 text-sm text-zinc-600">Columns were matched automatically where the name was recognised. Check each one; set &quot;Ignore&quot; for columns you don&apos;t need.</p>
            <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
              {sheet.headers.map((h, col) => (
                <div key={col} className="flex items-center gap-2">
                  <div className="w-1/2 min-w-0">
                    <div className="truncate text-sm font-medium" title={h}>{h}</div>
                    <div className="truncate text-xs text-zinc-400">{dataRows.slice(0, 3).map(({ r }) => r[col]).filter(Boolean).join(" · ") || "—"}</div>
                  </div>
                  <select
                    aria-label={`Field for column ${h}`}
                    value={mapping[col] ?? ""}
                    onChange={(e) => setMapping((m) => m.map((x, i) => (i === col ? e.target.value || null : x)))}
                    className={cx(inputClass, "w-1/2!", mapping[col] ? "border-emerald-300" : "text-zinc-400")}
                  >
                    <option value="">Ignore</option>
                    {SECTIONS.map((s) => (
                      <optgroup key={s.key} label={s.title}>
                        {IMPORTABLE_FIELDS.filter((f) => f.section === s.key).map((f) => {
                          const name = inputName(f);
                          const takenElsewhere = mapping.some((m, i) => m === name && i !== col) && f.type !== "textarea";
                          return (
                            <option key={name} value={name} disabled={takenElsewhere}>
                              {f.label}{takenElsewhere ? " (used)" : ""}
                            </option>
                          );
                        })}
                      </optgroup>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 border-t border-zinc-100 pt-4 sm:grid-cols-2">
              <Field label="If a row has no gender, treat it as" hint={mapped.has("gender") ? "Used only for rows where the gender cell is empty" : "No gender column. Choose one if the whole file is brides or grooms."}>
                <select value={defaultGender} onChange={(e) => setDefaultGender(e.target.value as typeof defaultGender)} className={inputClass}>
                  <option value="">No default (row is skipped)</option>
                  <option value="FEMALE">Bride</option>
                  <option value="MALE">Groom</option>
                </select>
              </Field>
              <Field label="If the phone number already exists">
                <select value={duplicates} onChange={(e) => setDuplicates(e.target.value as typeof duplicates)} className={inputClass}>
                  <option value="skip">Skip the row (recommended)</option>
                  <option value="import">Import anyway</option>
                </select>
              </Field>
            </div>
          </Card>

          <Card title={`3. Preview: ${okCount} of ${checked.length} rows ready`}>
            {!hasName && <div className="mb-3"><Alert>Match a column to &quot;Full name&quot;.</Alert></div>}
            {!hasGender && <div className="mb-3"><Alert>Match a column to &quot;Gender&quot; or choose a default above.</Alert></div>}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-zinc-500">
                  <tr>
                    <th className="px-2 py-1">Row</th>
                    <th className="px-2 py-1">Name</th>
                    <th className="px-2 py-1">Gender</th>
                    <th className="px-2 py-1">DOB</th>
                    <th className="px-2 py-1">Height</th>
                    <th className="px-2 py-1">Phone</th>
                    <th className="px-2 py-1">Problems</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {checked.slice(0, PREVIEW_ROWS).map((c) => (
                    <tr key={c.rowNumber} className={c.errors.length ? "bg-red-50/60" : ""}>
                      <td className="px-2 py-1 font-mono text-zinc-500">{c.rowNumber}</td>
                      <td className="px-2 py-1">{String(c.profile.fullName ?? "")}</td>
                      <td className="px-2 py-1">{c.profile.gender === "MALE" ? "Groom" : c.profile.gender === "FEMALE" ? "Bride" : ""}</td>
                      <td className="px-2 py-1">{c.profile.dob instanceof Date ? c.profile.dob.toISOString().slice(0, 10) : ""}</td>
                      <td className="px-2 py-1">{c.profile.heightCm ? `${c.profile.heightCm} cm` : ""}</td>
                      <td className="px-2 py-1">{String(c.profile.phone ?? "")}</td>
                      <td className="px-2 py-1 text-red-700">{c.errors.join("; ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {checked.length > PREVIEW_ROWS && (
              <p className="mt-2 text-xs text-zinc-500">
                Showing the first {PREVIEW_ROWS} rows.{" "}
                {checked.slice(PREVIEW_ROWS).filter((c) => c.errors.length).length > 0 && (
                  <Badge tone="red">{checked.slice(PREVIEW_ROWS).filter((c) => c.errors.length).length} more rows have problems</Badge>
                )}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4">
              <button onClick={doImport} disabled={pending || okCount === 0 || !hasName || !hasGender} className={buttonClass.primary}>
                {pending ? "Importing…" : `Import ${okCount} profile${okCount === 1 ? "" : "s"}`}
              </button>
              <span className="text-xs text-zinc-500">
                Rows with problems are skipped. Duplicate phone numbers are checked during the import.
              </span>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
