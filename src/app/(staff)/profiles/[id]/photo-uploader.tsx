"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cx } from "@/components/ui";
import { uploadPhoto } from "../actions";

const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.85;

/**
 * Picks photos, shrinks large ones in the browser (max 1600px JPEG), then uploads
 * them one per request so a big batch never hits a request-size limit.
 * Renders as a dashed "add" tile; size it with className.
 */
export function PhotoUploader({
  profileId,
  className,
  label = "Add photos",
  upload = uploadPhoto,
}: {
  profileId: string;
  className?: string;
  label?: string;
  /** Where the photo goes (the family's self-fill form uses its own, link-checked action) */
  upload?: (fd: FormData) => Promise<{ error?: string }>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    if (!files.length) return;
    const errs: string[] = [];
    for (let i = 0; i < files.length; i++) {
      setStatus(`Uploading ${i + 1}/${files.length}…`);
      try {
        const fd = new FormData();
        fd.set("profileId", profileId);
        fd.set("photo", await shrinkImage(files[i]));
        const res = await upload(fd);
        if (res.error) errs.push(`${files[i].name}: ${res.error}`);
      } catch {
        errs.push(`${files[i].name}: upload failed`);
      }
    }
    setErrors(errs);
    setStatus(null);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <div className={cx("flex flex-col", className)}>
      <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={onPick} className="hidden" />
      <button
        type="button"
        disabled={!!status}
        onClick={() => input.current?.click()}
        className="flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 p-2 text-center text-xs font-medium text-zinc-600 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-70"
      >
        <span className="text-2xl leading-none">{status ? "…" : "+"}</span>
        {status ?? label}
      </button>
      {errors.length > 0 && <p className="mt-1 text-xs text-red-600">{errors.join("; ")}</p>}
    </div>
  );
}

export async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file; // unknown format: let the server decide
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // transparent PNGs → white background
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", JPEG_QUALITY));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}
