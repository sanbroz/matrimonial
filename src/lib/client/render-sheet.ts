"use client";

/** Render a page element (biodata / receipt sheet) to a JPG or a one-page A4 PDF, in the browser. */

export async function renderJpeg(elementId: string, quality = 0.88): Promise<Blob> {
  const node = document.getElementById(elementId);
  if (!node) throw new Error("Nothing to render");
  await document.fonts.ready;
  const { toCanvas } = await import("html-to-image");
  // html-to-image's toBlob() always outputs PNG, so encode the JPEG ourselves (much smaller)
  const canvas = await toCanvas(node, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true });
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
  if (!blob) throw new Error("Could not create image");
  return blob;
}

export async function jpegToPdf(jpeg: Blob): Promise<Blob> {
  const dataUrl = await new Promise<string>((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.readAsDataURL(jpeg);
  });
  const img = await new Promise<HTMLImageElement>((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.src = dataUrl;
  });
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = 210, pageH = 297;
  const ratio = Math.min(pageW / img.width, pageH / img.height);
  const w = img.width * ratio, h = img.height * ratio;
  doc.addImage(dataUrl, "JPEG", (pageW - w) / 2, 0, w, h);
  return doc.output("blob");
}

export async function renderPdf(elementId: string): Promise<Blob> {
  return jpegToPdf(await renderJpeg(elementId));
}

async function blobToDataUrl(b: Blob) {
  return new Promise<string>((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.readAsDataURL(b);
  });
}

/** Several A4 page elements → one multi-page A4 PDF. */
export async function renderPdfPages(elementIds: string[]): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = 210, pageH = 297;
  for (let i = 0; i < elementIds.length; i++) {
    const dataUrl = await blobToDataUrl(await renderJpeg(elementIds[i]));
    const img = await new Promise<HTMLImageElement>((res) => {
      const im = new Image();
      im.onload = () => res(im);
      im.src = dataUrl;
    });
    const ratio = Math.min(pageW / img.width, pageH / img.height);
    if (i > 0) doc.addPage();
    doc.addImage(dataUrl, "JPEG", (pageW - img.width * ratio) / 2, 0, img.width * ratio, img.height * ratio);
  }
  return doc.output("blob");
}
