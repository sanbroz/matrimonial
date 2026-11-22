import { describe, expect, it } from "vitest";
import { faviconType } from "./favicon";

const bytes = (head: number[] | string) => {
  const h = typeof head === "string" ? [...head].map((c) => c.charCodeAt(0)) : head;
  return new Uint8Array([...h, ...new Array(16).fill(0)]);
};

describe("faviconType", () => {
  it("detects allowed image types from content", () => {
    expect(faviconType(bytes([0x89, 0x50, 0x4e, 0x47]))).toBe("image/png");
    expect(faviconType(bytes([0, 0, 1, 0]))).toBe("image/x-icon");
    expect(faviconType(bytes([0xff, 0xd8, 0xff]))).toBe("image/jpeg");
    expect(faviconType(bytes("RIFF\0\0\0\0WEBP"))).toBe("image/webp");
  });
  it("refuses SVG, HTML and tiny files", () => {
    expect(faviconType(bytes("<svg xmlns="))).toBeNull();
    expect(faviconType(bytes("<html>"))).toBeNull();
    expect(faviconType(new Uint8Array([0x89, 0x50]))).toBeNull();
  });
});
