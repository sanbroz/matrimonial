import { describe, expect, it } from "vitest";
import { readWhatsAppOptions, shouldAutoUpdate } from "./whatsapp-options";

const on = readWhatsAppOptions({ autoUpdate: true, hour: "03:00" });
const lib = { latest: "7.0.0-rc15", updateAvailable: true };
const at = (time: string, date = "2026-11-23") => ({ date, time });

describe("shouldAutoUpdate", () => {
  it("runs only when on, a newer version exists, and within the chosen hour", () => {
    expect(shouldAutoUpdate(on, lib, at("03:10"), false)).toBe(true);
    expect(shouldAutoUpdate(on, lib, at("04:00"), false)).toBe(false);
    expect(shouldAutoUpdate(readWhatsAppOptions({}), lib, at("03:10"), false)).toBe(false); // off by default
    expect(shouldAutoUpdate(on, { latest: "7.0.0-rc15", updateAvailable: false }, at("03:10"), false)).toBe(false);
    expect(shouldAutoUpdate(on, null, at("03:10"), false)).toBe(false);
  });
  it("never runs while another update is busy, twice a day, or for a version that failed", () => {
    expect(shouldAutoUpdate(on, lib, at("03:10"), true)).toBe(false);
    const tried = { ...on, lastAuto: { date: "2026-11-23", version: "7.0.0-rc15", result: "failed" as const, notified: true } };
    expect(shouldAutoUpdate(tried, lib, at("03:30"), false)).toBe(false);
    expect(shouldAutoUpdate({ ...on, skipVersion: "7.0.0-rc15" }, lib, at("03:10", "2026-11-24"), false)).toBe(false);
    // a newer release than the skipped one is tried again
    expect(shouldAutoUpdate({ ...on, skipVersion: "7.0.0-rc15" }, { ...lib, latest: "7.0.0-rc16" }, at("03:10", "2026-11-24"), false)).toBe(true);
  });
});
