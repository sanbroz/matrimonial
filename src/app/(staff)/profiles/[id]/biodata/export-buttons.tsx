"use client";

import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui";
import { renderJpeg as renderSheet, renderPdf } from "@/lib/client/render-sheet";

const SHEET_ID = "biodata-sheet";
const renderJpeg = () => renderSheet(SHEET_ID);

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function ExportButtons({ code, lang }: { code: string; lang: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  const base = `${code}-biodata${lang === "pa" ? "-punjabi" : ""}`;

  useEffect(() => {
    const probe = new File([new Blob()], "x.jpg", { type: "image/jpeg" });
    setCanShare(typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] }));
  }, []);

  async function run(kind: string, fn: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setError("Export failed. Please try again.");
      console.error(e);
    } finally {
      setBusy(null);
    }
  }

  const jpg = () => run("jpg", async () => download(await renderJpeg(), `${base}.jpg`));

  const pdf = () =>
    run("pdf", async () => download(await renderPdf(SHEET_ID), `${base}.pdf`));

  const share = () =>
    run("share", async () => {
      const file = new File([await renderJpeg()], `${base}.jpg`, { type: "image/jpeg" });
      await navigator.share({ files: [file], title: `Biodata ${code}` });
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canShare && (
        <button type="button" onClick={share} disabled={!!busy} className={buttonClass.primary}>
          {busy === "share" ? "Preparing…" : "Share (WhatsApp…)"}
        </button>
      )}
      <button type="button" onClick={jpg} disabled={!!busy} className={canShare ? buttonClass.secondary : buttonClass.primary}>
        {busy === "jpg" ? "Preparing…" : "Download image (JPG)"}
      </button>
      <button type="button" onClick={pdf} disabled={!!busy} className={buttonClass.secondary}>
        {busy === "pdf" ? "Preparing…" : "Download PDF"}
      </button>
      <button type="button" onClick={() => window.print()} disabled={!!busy} className={buttonClass.secondary}>Print</button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
