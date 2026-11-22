import { describe, expect, it } from "vitest";
import { open, seal } from "./secret-box";

const A = "a".repeat(40);
const B = "b".repeat(40);

describe("secret-box", () => {
  it("round-trips and never stores the plain text", () => {
    const s = seal("abcd efgh ijkl mnop", A);
    expect(s.startsWith("v1.")).toBe(true);
    expect(s).not.toContain("abcd");
    expect(open(s, A)).toBe("abcd efgh ijkl mnop");
  });
  it("gives a different ciphertext each time", () => {
    expect(seal("x", A)).not.toBe(seal("x", A));
  });
  it("refuses the wrong key or tampered data", () => {
    const s = seal("secret", A);
    expect(open(s, B)).toBeNull();
    const parts = s.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(open(parts.join("."), A)).toBeNull();
    expect(open("garbage", A)).toBeNull();
  });
});
