"use client";

import { useEffect, useState } from "react";
import { buttonClass } from "./ui";
import { renderJpeg, renderPdfPages } from "@/lib/client/render-sheet";

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Export the share pages (share-page-0 … share-page-N): PDF, images, phone share sheet, print. */
export function ShareExport({ pages, filename, compact = false }: { pages: number; filename: string; compact?: boolean }) {
  const ids = Array.from({ length: pages }, (_, i) => `share-page-${i}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

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

  const images = async () => {
    const files: File[] = [];
    for (let i = 0; i < ids.length; i++) {
      files.push(new File([await renderJpeg(ids[i])], `${filename}${ids.length > 1 ? `-${i + 1}` : ""}.jpg`, { type: "image/jpeg" }));
    }
    return files;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canShare && (
        <button
          type="button"
          disabled={!!busy}
          className={buttonClass.primary}
          onClick={() => run("share", async () => navigator.share({ files: await images(), title: filename }))}
        >
          {busy === "share" ? "Preparing…" : `Share image${pages > 1 ? "s" : ""} (WhatsApp…)`}
        </button>
      )}
      <button
        type="button"
        disabled={!!busy}
        className={canShare ? buttonClass.secondary : buttonClass.primary}
        onClick={() => run("pdf", async () => download(await renderPdfPages(ids), `${filename}.pdf`))}
      >
        {busy === "pdf" ? "Preparing…" : `Download PDF${pages > 1 ? ` (${pages} pages)` : ""}`}
      </button>
      {!compact && (
        <button
          type="button"
          disabled={!!busy}
          className={buttonClass.secondary}
          onClick={() =>
            run("jpg", async () => {
              for (const f of await images()) download(f, f.name);
            })
          }
        >
          {busy === "jpg" ? "Preparing…" : `Download image${pages > 1 ? "s" : ""} (JPG)`}
        </button>
      )}
      {!compact && (
        <button type="button" onClick={() => window.print()} disabled={!!busy} className={buttonClass.secondary}>Print</button>
      )}
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
