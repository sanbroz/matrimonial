import type { BiodataContent } from "@/lib/biodata";
import type { BiodataOptions } from "@/lib/biodata-options";
import { t, type LabelKey } from "@/lib/biodata-i18n";
import { CARD_FIELDS, LAYOUTS, TWO_UP_FIELDS, chunk, type Layout } from "@/lib/share";
import { BiodataSheet, type SheetBranding } from "./biodata-sheet";

export interface SheetItem {
  id: string;
  content: BiodataContent;
  photoUrls: string[];
}

const FONT = '"Noto Sans Gurmukhi", "Segoe UI", Arial, sans-serif';
const PAGE = { width: 794, height: 1123 }; // A4 at 96 dpi

/**
 * The pages for sharing several biodatas. Each page is an A4 element with id "share-page-<n>",
 * which is what gets exported to PDF / JPG / print. Only biodata content is shown (profile codes,
 * never names or contact details).
 */
export function SharePages({
  items,
  layout,
  lang,
  options,
  branding,
}: {
  items: SheetItem[];
  layout: Layout;
  lang: "en" | "pa";
  options: BiodataOptions;
  branding: SheetBranding;
}) {
  if (layout === "full") {
    return (
      <>
        {items.map((it, i) => (
          <div key={it.id} className="mx-auto w-fit shadow-lg print:shadow-none">
            <BiodataSheet id={`share-page-${i}`} content={it.content} options={options} branding={branding} photoUrls={it.photoUrls} />
          </div>
        ))}
      </>
    );
  }
  const pages = chunk(items, LAYOUTS[layout].perPage);
  return (
    <>
      {pages.map((page, i) => (
        <div key={i} className="mx-auto w-fit shadow-lg print:shadow-none">
          <Page id={`share-page-${i}`} n={i + 1} of={pages.length} lang={lang} options={options} branding={branding}>
            {layout === "two" && <TwoUp items={page} accent={options.accentColor} lang={lang} />}
            {layout === "cards" && <Cards items={page} accent={options.accentColor} lang={lang} />}
            {layout === "list" && <List items={page} accent={options.accentColor} lang={lang} />}
          </Page>
        </div>
      ))}
    </>
  );
}

function Page({
  id,
  n,
  of,
  lang,
  options,
  branding,
  children,
}: {
  id: string;
  n: number;
  of: number;
  lang: "en" | "pa";
  options: BiodataOptions;
  branding: SheetBranding;
  children: React.ReactNode;
}) {
  const accent = options.accentColor;
  const contact = [branding.phone && `☎ ${branding.phone}`, branding.whatsapp && `WhatsApp ${branding.whatsapp}`].filter(Boolean).join("   ");
  return (
    <div
      id={id}
      lang={lang}
      className="print-sheet flex flex-col overflow-hidden bg-white text-[12px] leading-snug text-zinc-800"
      style={{ ...PAGE, fontFamily: FONT }}
    >
      <div style={{ background: accent }} className="flex items-center gap-3 px-7 py-3 text-white">
        {branding.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branding.logoUrl} alt="" className="h-10 w-10 rounded bg-white object-contain p-0.5" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[18px] font-bold leading-tight">{branding.bureauName}</div>
          {(options.headerText || branding.tagline) && <div className="text-[11px] opacity-90">{options.headerText || branding.tagline}</div>}
        </div>
        {of > 1 && <div className="text-[11px] opacity-80">{n} / {of}</div>}
      </div>
      <div className="min-h-0 flex-1 px-7 py-4">{children}</div>
      <div className="px-7 pb-4">
        <div className="rounded-md px-3 py-2 text-center" style={{ background: `${accent}12`, border: `1px solid ${accent}40` }}>
          {options.showBureauContact && contact && (
            <div className="text-[13px] font-semibold" style={{ color: accent }}>{branding.bureauName} · {contact}</div>
          )}
          {options.footerText && <div className="text-[11px] text-zinc-600">{options.footerText}</div>}
          <div className="text-[10px] text-zinc-400">{t("contact", lang)}</div>
        </div>
      </div>
    </div>
  );
}

const facts = (c: BiodataContent, keys: LabelKey[], lang: "en" | "pa") =>
  keys.filter((k) => c.facts[k]).map((k) => [t(k, lang), c.facts[k]!] as const);

function Photo({ url, w, h, accent }: { url?: string; w: number; h: number; accent: string }) {
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="shrink-0 rounded-md object-cover" style={{ width: w, height: h, border: `2px solid ${accent}` }} />
  );
}

function Head({ c, accent, size = 16 }: { c: BiodataContent; accent: string; size?: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0 truncate font-bold" style={{ color: accent, fontSize: size }}>{c.name ?? c.title}</div>
        <div className="shrink-0 font-mono font-bold" style={{ fontSize: size - 1 }}>{c.code}</div>
      </div>
      {c.name && <div className="text-[11px] text-zinc-500">{c.title}</div>}
    </div>
  );
}

/** Label / value rows in a fixed label column, so values line up across rows and profiles. One line each. */
function FactGrid({ rows, cols, labelWidth }: { rows: (readonly [string, string])[]; cols: 1 | 2; labelWidth: number }) {
  const template = cols === 2 ? `${labelWidth}px minmax(0,1fr) ${labelWidth}px minmax(0,1fr)` : `${labelWidth}px minmax(0,1fr)`;
  return (
    <div className="grid gap-x-2 gap-y-[3px] leading-[17px]" style={{ gridTemplateColumns: template }}>
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <div className="truncate text-zinc-500">{k}</div>
          <div className="truncate font-medium text-zinc-900" title={v}>{v}</div>
        </div>
      ))}
    </div>
  );
}

/** 3 per page: every block the same height (a third of the page), photo + two columns of details. */
function TwoUp({ items, accent, lang }: { items: SheetItem[]; accent: string; lang: "en" | "pa" }) {
  return (
    <div className="grid h-full grid-rows-3 gap-3">
      {items.map((it) => {
        // Main fields first, then everything else that is being shared
        const main = facts(it.content, TWO_UP_FIELDS, lang);
        const seen = new Set<string>(main.map(([k]) => k));
        const rest = it.content.sections.filter((s) => !s.text).flatMap((s) => s.rows).filter(([k]) => !seen.has(k));
        const rows = [...main, ...rest].slice(0, it.photoUrls[0] ? 22 : 26);
        return (
          <div key={it.id} className="flex min-h-0 gap-4 overflow-hidden rounded-lg p-3" style={{ border: `1px solid ${accent}40` }}>
            <Photo url={it.photoUrls[0]} w={160} h={208} accent={accent} />
            <div className="min-w-0 flex-1">
              <Head c={it.content} accent={accent} size={17} />
              {it.content.summary && <div className="mb-2 mt-0.5 truncate text-[12px] text-zinc-600">{it.content.summary}</div>}
              <FactGrid rows={rows} cols={2} labelWidth={it.photoUrls[0] ? 92 : 108} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 6 per page in a fixed 2 × 3 grid: every card the same size, details aligned. */
function Cards({ items, accent, lang }: { items: SheetItem[]; accent: string; lang: "en" | "pa" }) {
  return (
    <div className="grid h-full grid-cols-2 grid-rows-3 gap-3">
      {items.map((it) => {
        const photo = it.photoUrls[0];
        const rows = facts(it.content, CARD_FIELDS, lang).slice(0, 12);
        return (
          <div key={it.id} className="flex min-h-0 flex-col overflow-hidden rounded-lg p-3" style={{ border: `1px solid ${accent}40` }}>
            <Head c={it.content} accent={accent} size={14} />
            <div className="mt-2 flex min-h-0 gap-3 text-[12px]">
              <Photo url={photo} w={96} h={124} accent={accent} />
              <div className="min-w-0 flex-1">
                <FactGrid rows={rows} cols={1} labelWidth={photo ? 82 : 100} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const LIST_COLS: { keys: LabelKey[]; head: LabelKey }[] = [
  { keys: ["age", "height"], head: "age" },
  { keys: ["maritalStatus"], head: "maritalStatus" },
  { keys: ["religionField", "caste"], head: "religion" },
  { keys: ["education", "profession"], head: "career" },
  { keys: ["livesIn", "visaStatus"], head: "location" },
];

function List({ items, accent, lang }: { items: SheetItem[]; accent: string; lang: "en" | "pa" }) {
  const photos = items.some((i) => i.photoUrls.length);
  // Only columns that have something for at least one profile (sections not shared drop out)
  const cols = LIST_COLS.filter((c) => items.some((it) => c.keys.some((k) => it.content.facts[k])));
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr style={{ color: accent }} className="text-left text-[11px] font-bold uppercase tracking-wide">
          {photos && <th className="w-[70px] pb-2" />}
          <th className="pb-2 pr-2">{t("profileCode", lang)}</th>
          {cols.map((c) => <th key={c.head} className="pb-2 pr-2">{t(c.head, lang)}</th>)}
        </tr>
      </thead>
      <tbody>
        {items.map((it) => (
          <tr key={it.id} className="align-top" style={{ borderTop: `1px solid ${accent}30` }}>
            {photos && (
              <td className="py-2 pr-2">
                {it.photoUrls[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.photoUrls[0]} alt="" className="h-[80px] w-[62px] rounded object-cover" />
                ) : null}
              </td>
            )}
            <td className="py-2 pr-2">
              <div className="font-mono text-[13px] font-bold">{it.content.code}</div>
              {it.content.name && <div className="text-[12px] font-semibold text-zinc-900">{it.content.name}</div>}
              <div className="text-[11px] text-zinc-500">{it.content.title}</div>
            </td>
            {cols.map((c) => (
              <td key={c.head} className="py-2 pr-2">
                {c.keys.map((k) => it.content.facts[k]).filter(Boolean).map((v, i) => (
                  <div key={i} className={i === 0 ? "font-medium text-zinc-900" : "text-zinc-600"}>{v}</div>
                ))}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const sharePageCount = (n: number, layout: Layout) => (layout === "full" ? n : Math.ceil(n / LAYOUTS[layout].perPage));
