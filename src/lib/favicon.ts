/** Favicon uploads: detect the real type from the file's first bytes (never trust the browser's type). Pure. */

export const MAX_FAVICON_BYTES = 256 * 1024;

export function faviconType(buf: Uint8Array): string | null {
  const b = (i: number) => buf[i];
  if (buf.length < 12) return null;
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return "image/png";
  if (b(0) === 0x00 && b(1) === 0x00 && b(2) === 0x01 && b(3) === 0x00) return "image/x-icon";
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "image/jpeg";
  if (String.fromCharCode(b(0), b(1), b(2), b(3)) === "RIFF" && String.fromCharCode(b(8), b(9), b(10), b(11)) === "WEBP") return "image/webp";
  return null; // SVG and everything else refused (SVG can carry scripts)
}
