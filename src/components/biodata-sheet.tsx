import type { BiodataContent } from "@/lib/biodata";
import type { BiodataOptions } from "@/lib/biodata-options";

export interface SheetBranding {
  bureauName: string;
  tagline: string | null;
  phone: string | null;
  whatsapp: string | null;
  logoUrl: string | null;
}

/**
 * The A4 biodata itself (794 × 1123 px = A4 at 96 dpi). Everything inside is what gets
 * exported to JPG / PDF / print, so it uses inline colours and no app chrome.
 */
export function BiodataSheet({
  content,
  options,
  branding,
  photoUrls,
  id = "biodata-sheet",
}: {
  id?: string;
  content: BiodataContent;
  options: BiodataOptions;
  branding: SheetBranding;
  photoUrls: string[];
}) {
  const accent = options.accentColor;
  const [mainPhoto, ...morePhotos] = options.sections.includes("photo") ? photoUrls : [];
  const textSections = content.sections.filter((s) => s.text);
  const rowSections = content.sections.filter((s) => !s.text);
  const contact = [branding.phone && `☎ ${branding.phone}`, branding.whatsapp && `WhatsApp ${branding.whatsapp}`].filter(Boolean).join("   ");

  return (
    <div
      id={id}
      lang={content.lang === "pa" ? "pa" : "en"}
      className="print-sheet relative flex flex-col bg-white text-[13px] leading-snug text-zinc-800"
      style={{ width: 794, minHeight: 1123, fontFamily: '"Noto Sans Gurmukhi", "Segoe UI", Arial, sans-serif' }}
    >
      {/* Header band */}
      <div style={{ background: accent }} className="px-8 pb-4 pt-3 text-white">
        {options.headerText && <div className="mb-1 text-center text-[15px] font-semibold tracking-wide">{options.headerText}</div>}
        <div className="flex items-center gap-4">
          {branding.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt="" className="h-14 w-14 rounded-md bg-white object-contain p-1" />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[22px] font-bold leading-tight">{branding.bureauName}</div>
            {branding.tagline && <div className="text-[12px] opacity-90">{branding.tagline}</div>}
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider opacity-80">{content.codeLabel}</div>
            <div className="font-mono text-[22px] font-bold">{content.code}</div>
          </div>
        </div>
      </div>

      {/* Title + photo + summary */}
      <div className="flex gap-6 px-8 pt-6">
        {mainPhoto && (
          <div className="flex shrink-0 flex-col gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mainPhoto} alt="" className="h-[260px] w-[200px] rounded-lg object-cover" style={{ border: `3px solid ${accent}` }} />
            {morePhotos.length > 0 && (
              <div className="flex gap-2">
                {morePhotos.slice(0, 2).map((u) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={u} src={u} alt="" className="h-[124px] w-[96px] rounded-md object-cover" />
                ))}
              </div>
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] font-bold" style={{ color: accent }}>{content.title}</h1>
          <p className="mt-1 text-[14px] text-zinc-600">{content.summary}</p>
          {textSections.filter((s) => s.key === "about").map((s) => (
            <p key={s.key} className="mt-4 whitespace-pre-wrap rounded-md bg-zinc-50 p-3 text-[13px] italic text-zinc-700">{s.text}</p>
          ))}
          {/* First section next to the photo to use the space */}
          {rowSections[0] && <SectionBlock s={rowSections[0]} accent={accent} />}
        </div>
      </div>

      {/* Remaining sections in two columns */}
      <div className="grid flex-1 grid-cols-2 content-start gap-x-6 gap-y-1 px-8 pt-2">
        {rowSections.slice(1).map((s) => (
          <SectionBlock key={s.key} s={s} accent={accent} />
        ))}
        {textSections.filter((s) => s.key !== "about").map((s) => (
          <div key={s.key} className="col-span-2 mt-3">
            <SectionTitle title={s.title} accent={accent} />
            <p className="whitespace-pre-wrap">{s.text}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-6 px-8 pb-6">
        <div className="rounded-lg px-4 py-3 text-center" style={{ background: `${accent}12`, border: `1px solid ${accent}40` }}>
          {options.showBureauContact && contact && (
            <>
              <div className="text-[12px] text-zinc-600">{content.contactLabel}</div>
              <div className="text-[15px] font-semibold" style={{ color: accent }}>{branding.bureauName} · {contact}</div>
            </>
          )}
          {options.footerText && <div className="mt-1 text-[12px] text-zinc-600">{options.footerText}</div>}
          <div className="mt-1 text-[11px] text-zinc-400">{content.codeLabel}: {content.code}</div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title, accent }: { title: string; accent: string }) {
  return (
    <div className="mb-1.5 mt-3 flex items-center gap-2">
      <span className="text-[13px] font-bold uppercase tracking-wide" style={{ color: accent }}>{title}</span>
      <span className="h-px flex-1" style={{ background: `${accent}40` }} />
    </div>
  );
}

function SectionBlock({ s, accent }: { s: { title: string; rows: [string, string][] }; accent: string }) {
  return (
    <div>
      <SectionTitle title={s.title} accent={accent} />
      <table className="w-full">
        <tbody>
          {s.rows.map(([k, v]) => (
            <tr key={k} className="align-top">
              <td className="w-[150px] py-[3px] pr-2 text-zinc-500">{k}</td>
              <td className="py-[3px] font-medium text-zinc-900">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
