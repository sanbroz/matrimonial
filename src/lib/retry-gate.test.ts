import { describe, expect, it } from "vitest";
import { RETRY_WAIT_MINUTES, RetryGate } from "./retry-gate";

const MIN = 60_000;

describe("RetryGate", () => {
  it("allows the first try and waits longer after each failure", () => {
    const g = new RetryGate();
    const t0 = 1_000_000;
    expect(g.canTry("a", "2026-11-23", t0)).toBe(true);
    expect(g.failed("a", "2026-11-23", t0)?.getTime()).toBe(t0 + 10 * MIN);
    expect(g.canTry("a", "2026-11-23", t0 + 9 * MIN)).toBe(false);
    expect(g.canTry("a", "2026-11-23", t0 + 10 * MIN)).toBe(true);
    expect(g.failed("a", "2026-11-23", t0 + 10 * MIN)?.getTime()).toBe(t0 + 40 * MIN);
  });

  it("gives up for the day after the last wait, and starts fresh the next day", () => {
    const g = new RetryGate();
    for (let i = 0; i < RETRY_WAIT_MINUTES.length; i++) expect(g.failed("a", "2026-11-23", 0)).not.toBeNull();
    expect(g.failed("a", "2026-11-23", 0)).toBeNull();
    expect(g.canTry("a", "2026-11-23", 10 ** 12)).toBe(false);
    expect(g.canTry("a", "2026-11-24", 0)).toBe(true);
  });

  it("keeps keys apart and forgets on success", () => {
    const g = new RetryGate();
    g.failed("a", "d", 0);
    expect(g.canTry("b", "d", 0)).toBe(true);
    g.succeeded("a");
    expect(g.canTry("a", "d", 0)).toBe(true);
  });
});
