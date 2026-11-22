"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui";

type Status = {
  status: "starting" | "qr" | "connecting" | "open" | "logged_out" | "closed" | "unavailable";
  qr: string | null;
  me: { id: string | null; name: string | null } | null;
  lastError: string | null;
};

const LABEL: Record<Status["status"], [string, "green" | "amber" | "red" | "zinc"]> = {
  open: ["Connected", "green"],
  qr: ["Waiting for QR scan", "amber"],
  connecting: ["Connecting…", "amber"],
  starting: ["Starting…", "amber"],
  logged_out: ["Unlinked", "red"],
  closed: ["Disconnected", "red"],
  unavailable: ["Not available", "zinc"],
};

/** Live connection status; shows (and refreshes) the QR code while linking. */
export function LinkStatus({ initial }: { initial: Status }) {
  const [s, setS] = useState(initial);
  useEffect(() => {
    if (s.status === "unavailable") return;
    const t = setInterval(async () => {
      try {
        const r = await fetch("/api/whatsapp/status", { cache: "no-store" });
        if (r.ok) setS(await r.json());
      } catch {}
    }, s.status === "open" ? 15_000 : 3000);
    return () => clearInterval(t);
  }, [s.status]);

  const [label, tone] = LABEL[s.status] ?? ["Unknown", "zinc"];
  const number = s.me?.id?.split(/[:@]/)[0];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={tone}>{label}</Badge>
        {s.status === "open" && number && <span>Linked number: <strong>+{number}</strong>{s.me?.name ? ` (${s.me.name})` : ""}</span>}
        {s.lastError && s.status !== "open" && <span className="text-xs text-zinc-500">{s.lastError}</span>}
      </div>
      {s.status === "qr" && s.qr && (
        <div className="flex flex-wrap items-start gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.qr} alt="WhatsApp QR code" className="size-64 rounded-lg border border-zinc-200 bg-white p-2" />
          <ol className="max-w-sm list-decimal space-y-1 pl-5 text-sm text-zinc-700">
            <li>Open WhatsApp on the <strong>bureau&apos;s phone</strong>.</li>
            <li>Tap <strong>⋮ / Settings → Linked devices → Link a device</strong>.</li>
            <li>Point the phone at this code. It refreshes by itself every few seconds.</li>
          </ol>
        </div>
      )}
    </div>
  );
}
