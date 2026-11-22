"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, cx } from "@/components/ui";
import { photoAction } from "../actions";
import { PhotoUploader } from "./photo-uploader";

export type GalleryPhoto = { id: string; url: string; isPrimary: boolean; onBiodata: boolean };

/**
 * Main photo large, the rest as thumbnails, plus an "add" tile.
 * Clicking a photo opens a popup viewer (native <dialog>: Esc closes, focus is trapped)
 * with previous/next (also arrow keys) and the photo actions.
 */
export function PhotoGallery({ profileId, photos }: { profileId: string; photos: GalleryPhoto[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const open = (i: number) => {
    setIndex(i);
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();
  const step = useCallback((d: number) => setIndex((i) => (i == null ? i : (i + d + photos.length) % photos.length)), [photos.length]);

  // Keep the index valid when photos change (e.g. after a delete)
  useEffect(() => {
    if (index == null) return;
    if (photos.length === 0) close();
    else if (index >= photos.length) setIndex(photos.length - 1);
  }, [photos.length, index]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    d.addEventListener("keydown", onKey);
    return () => d.removeEventListener("keydown", onKey);
  }, [step]);

  function act(op: "primary" | "toggleBiodata" | "delete") {
    const ph = index != null ? photos[index] : null;
    if (!ph) return;
    if (op === "delete" && !window.confirm("Delete this photo permanently?")) return;
    const fd = new FormData();
    fd.set("photoId", ph.id);
    fd.set("op", op);
    start(async () => {
      await photoAction(fd);
      if (op === "primary") setIndex(0); // the main photo is listed first
      router.refresh();
    });
  }

  const [main, ...rest] = photos;
  const current = index != null ? photos[index] : null;

  return (
    <>
      {photos.length === 0 ? (
        <div className="flex items-center gap-4">
          <PhotoUploader profileId={profileId} className="h-40 w-32 shrink-0" />
          <p className="text-sm text-zinc-500">No photos yet. Add JPG, PNG or WebP photos. Large photos are shrunk automatically.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={() => open(0)} className="group relative w-40 shrink-0 self-start overflow-hidden rounded-lg sm:w-44">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={main.url} alt="Main photo" className="aspect-[3/4] w-full object-cover transition group-hover:scale-[1.02]" />
            <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white">Main</span>
            {!main.onBiodata && <HiddenTag />}
          </button>
          <div className="grid flex-1 grid-cols-4 content-start gap-2 sm:grid-cols-[repeat(auto-fill,minmax(5.5rem,6.5rem))]">
            {rest.map((ph, i) => (
              <button key={ph.id} type="button" onClick={() => open(i + 1)} className="group relative overflow-hidden rounded-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ph.url} alt={`Photo ${i + 2}`} className="aspect-[3/4] w-full object-cover transition group-hover:opacity-90" />
                {!ph.onBiodata && <HiddenTag />}
              </button>
            ))}
            <PhotoUploader profileId={profileId} className="aspect-[3/4]" label="Add" />
          </div>
        </div>
      )}

      <dialog
        ref={dialog}
        onClose={() => setIndex(null)}
        onClick={(e) => e.target === dialog.current && close()}
        className="m-auto max-h-none max-w-none bg-transparent p-0 backdrop:bg-black/80"
      >
        {current && (
          <div className="flex h-[100dvh] w-[100vw] flex-col items-center justify-center gap-3 bg-zinc-950/90 p-3 sm:p-6" onClick={(e) => e.target === e.currentTarget && close()}>
            <div className="flex w-full max-w-4xl items-center justify-between text-sm text-white">
              <span>
                {index! + 1} / {photos.length}
                {current.isPrimary && <span className="ml-2 rounded bg-white/20 px-1.5 py-0.5 text-xs">Main</span>}
                <span className={cx("ml-2 rounded px-1.5 py-0.5 text-xs", current.onBiodata ? "bg-emerald-500/30" : "bg-white/20")}>
                  {current.onBiodata ? "Shown on biodata" : "Hidden from biodata"}
                </span>
              </span>
              <button type="button" onClick={close} className="rounded px-2 py-1 text-2xl leading-none hover:bg-white/10" aria-label="Close">×</button>
            </div>
            <div className="relative flex min-h-0 w-full max-w-4xl flex-1 items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current.url} alt="" className={cx("max-h-full max-w-full rounded object-contain", pending && "opacity-60")} />
              {photos.length > 1 && (
                <>
                  <NavButton side="left" onClick={() => step(-1)} />
                  <NavButton side="right" onClick={() => step(1)} />
                </>
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {!current.isPrimary && (
                <button type="button" disabled={pending} onClick={() => act("primary")} className={buttonClass.secondary}>Make main photo</button>
              )}
              <button type="button" disabled={pending} onClick={() => act("toggleBiodata")} className={buttonClass.secondary}>
                {current.onBiodata ? "Hide from biodata" : "Show on biodata"}
              </button>
              <a href={current.url} target="_blank" className={buttonClass.secondary}>Open full size</a>
              <button type="button" disabled={pending} onClick={() => act("delete")} className={buttonClass.danger}>Delete</button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}

function HiddenTag() {
  return <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 py-0.5 text-[10px] text-white">Not on biodata</span>;
}

function NavButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous photo" : "Next photo"}
      className={cx(
        "absolute top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-2xl leading-none text-white hover:bg-black/70",
        side === "left" ? "left-1" : "right-1",
      )}
    >
      {side === "left" ? "‹" : "›"}
    </button>
  );
}
