"use client";

import { useRef, useState } from "react";
import { renderJpeg, renderPdf, renderPdfPages } from "@/lib/client/render-sheet";
import { buttonClass, cx, inputClass, Field } from "./ui";

export type SendAction = (fd: FormData) => Promise<{ ok: boolean; error?: string; note?: string }>;

/**
 * Button + dialog to send one WhatsApp message or email. Staff see and can edit the text first.
 * Optional attachment is rendered from a page element (biodata / receipt) when sending.
 */
export function SendMessageButton({
  channel,
  label,
  title,
  action,
  defaultTo,
  defaultSubject,
  defaultText,
  fields,
  attach,
  variant = "secondary",
  className,
  disabledReason,
}: {
  channel: "whatsapp" | "email";
  label: string;
  title: string;
  action: SendAction;
  defaultTo?: string | null;
  defaultSubject?: string;
  defaultText: string;
  /** Hidden values passed to the action (ids, kind…) */
  fields?: Record<string, string>;
  /** elementId: one sheet, or several page ids for a multi-page PDF */
  attach?: { elementId: string | string[]; as: "jpg" | "pdf"; filename: string };
  variant?: keyof typeof buttonClass;
  className?: string;
  /** Show the button disabled with this explanation (e.g. WhatsApp not linked) */
  disabledReason?: string | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setResult(null);
    try {
      if (attach) {
        const ids = Array.isArray(attach.elementId) ? attach.elementId : [attach.elementId];
        const blob = attach.as === "pdf" ? (ids.length > 1 ? await renderPdfPages(ids) : await renderPdf(ids[0])) : await renderJpeg(ids[0]);
        fd.set("file", new File([blob], attach.filename, { type: attach.as === "pdf" ? "application/pdf" : "image/jpeg" }));
      }
      const r = await action(fd);
      setResult(r.ok ? { ok: true, text: r.note ?? "Sent." } : { ok: false, text: r.error ?? "Not sent." });
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : "Not sent." });
    } finally {
      setBusy(false);
    }
  }

  const icon = channel === "whatsapp" ? "💬" : "✉️";
  return (
    <>
      {/* Not `disabled`: a disabled button can't explain itself on a phone (no hover tooltips).
          When unavailable, the dialog shows the reason instead of the form. */}
      <button
        type="button"
        aria-disabled={!!disabledReason}
        title={disabledReason ?? undefined}
        onClick={() => {
          setResult(null);
          dialog.current?.showModal();
        }}
        className={cx(buttonClass[variant], disabledReason && "opacity-50", className)}
      >
        <span aria-hidden>{icon}</span> {label}
      </button>
      <dialog ref={dialog} className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-xl p-0 shadow-xl backdrop:bg-black/40">
        {disabledReason ? (
          <div className="space-y-3 p-5">
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="text-sm text-zinc-700">Can&apos;t send right now: {disabledReason}.</p>
            <div className="flex justify-end">
              <button type="button" onClick={() => dialog.current?.close()} className={buttonClass.secondary}>OK</button>
            </div>
          </div>
        ) : (
        <form onSubmit={submit} className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base font-semibold">{title}</h2>
            <button type="button" onClick={() => dialog.current?.close()} className="text-xl leading-none text-zinc-400 hover:text-zinc-700" aria-label="Close">×</button>
          </div>
          {Object.entries(fields ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <Field label={channel === "whatsapp" ? "WhatsApp number" : "Email address"}>
            <input
              name="to"
              required
              type={channel === "email" ? "email" : "tel"}
              defaultValue={defaultTo ?? ""}
              placeholder={channel === "whatsapp" ? "98xxxxxxxx or +1…" : "family@example.com"}
              className={inputClass}
            />
          </Field>
          {channel === "email" && (
            <Field label="Subject"><input name="subject" required defaultValue={defaultSubject} className={inputClass} /></Field>
          )}
          <Field label="Message" hint={attach ? `${attach.as === "pdf" ? "PDF" : "Image"} attached: ${attach.filename}` : undefined}>
            <textarea name="text" rows={6} defaultValue={defaultText} required className={inputClass} />
          </Field>
          {result && (
            <p className={cx("rounded-md px-3 py-2 text-sm", result.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800")}>{result.text}</p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => dialog.current?.close()} className={buttonClass.secondary}>{result?.ok ? "Close" : "Cancel"}</button>
            {!result?.ok && (
              <button type="submit" disabled={busy} className={buttonClass.primary}>
                {busy ? (attach ? "Preparing & sending…" : "Sending…") : "Send"}
              </button>
            )}
          </div>
        </form>
        )}
      </dialog>
    </>
  );
}
