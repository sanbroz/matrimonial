import { describe, expect, it } from "vitest";
import { AttemptLimiter } from "./rate-limit";

describe("AttemptLimiter", () => {
  it("blocks after max failures within the window and frees up after it", () => {
    const l = new AttemptLimiter({ windowMs: 60_000, max: 3 });
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) {
      expect(l.blockedFor("a", t0 + i)).toBe(0);
      l.fail("a", t0 + i);
    }
    expect(l.blockedFor("a", t0 + 10)).toBeGreaterThan(59_000);
    expect(l.blockedFor("b", t0 + 10)).toBe(0); // other keys unaffected
    expect(l.blockedFor("a", t0 + 60_001)).toBe(0); // oldest failure expired
  });

  it("reset clears the counter", () => {
    const l = new AttemptLimiter({ windowMs: 60_000, max: 2 });
    l.fail("a", 1);
    l.fail("a", 2);
    expect(l.blockedFor("a", 3)).toBeGreaterThan(0);
    l.reset("a");
    expect(l.blockedFor("a", 3)).toBe(0);
  });
});
