"use client";

import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui";

const SHEET_ID = "biodata-sheet";

async function renderJpeg(): Promise<Blob> {
  const node = document.getElementById(SHEET_ID);
  if (!node) throw new Error("Biodata not found");
  await document.fonts.ready;
  const { toCanvas } = await import("html-to-image");
  // pixelRatio 2 → sharp on phones. html-to-image's toBlob() always outputs PNG,
  // so encode the JPEG ourselves (PNG would be several times larger).
  const canvas = await toCanvas(node, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true });
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.88));
  if (!blob) throw new Error("Could not create image");
  return blob;
}

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
    run("pdf", async () => {
      const blob = await renderJpeg();
      const dataUrl = await new Promise<string>((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.readAsDataURL(blob);
      });
      const img = await new Promise<HTMLImageElement>((res) => {
        const i = new Image();
        i.onload = () => res(i);
        i.src = dataUrl;
      });
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      // Fit the whole sheet on one A4 page
      const pageW = 210, pageH = 297;
      const ratio = Math.min(pageW / img.width, pageH / img.height);
      const w = img.width * ratio, h = img.height * ratio;
      doc.addImage(dataUrl, "JPEG", (pageW - w) / 2, 0, w, h);
      doc.save(`${base}.pdf`);
    });

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
