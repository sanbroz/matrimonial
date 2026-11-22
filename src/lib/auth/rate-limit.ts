/**
 * Login attempt limiter (in memory — the app runs as a single server process).
 * Blocks an email after 5 failures in 15 minutes, and an IP after 20, so passwords
 * can't be guessed from the internet. A successful login clears the email's counter.
 */

export interface LimiterOptions {
  windowMs: number;
  max: number;
}

export class AttemptLimiter {
  private hits = new Map<string, number[]>();
  constructor(private opts: LimiterOptions) {}

  private recent(key: string, now: number) {
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.opts.windowMs);
    if (list.length) this.hits.set(key, list);
    else this.hits.delete(key);
    return list;
  }

  /** Milliseconds until the key may try again, or 0 if allowed now. */
  blockedFor(key: string, now = Date.now()): number {
    const list = this.recent(key, now);
    if (list.length < this.opts.max) return 0;
    return this.opts.windowMs - (now - list[list.length - this.opts.max]);
  }

  fail(key: string, now = Date.now()) {
    const list = this.recent(key, now);
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 10_000) this.prune(now);
  }

  reset(key: string) {
    this.hits.delete(key);
  }

  private prune(now: number) {
    for (const key of this.hits.keys()) this.recent(key, now);
  }
}

const g = globalThis as unknown as { __loginLimits?: { email: AttemptLimiter; ip: AttemptLimiter } };
export const loginLimits = (g.__loginLimits ??= {
  email: new AttemptLimiter({ windowMs: 15 * 60_000, max: 5 }),
  ip: new AttemptLimiter({ windowMs: 15 * 60_000, max: 20 }),
});
