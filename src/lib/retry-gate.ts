/**
 * Retries a once-a-day job after a failure, with growing waits, then gives up for that day.
 * In memory (the app runs as one server); a restart simply allows a fresh try. Pure, unit-tested.
 */
export const RETRY_WAIT_MINUTES = [10, 30, 60, 120] as const;

type State = { date: string; failures: number; nextAt: number };

export class RetryGate {
  private state = new Map<string, State>();

  /** May the job for `key` run now? (always yes until it has failed today) */
  canTry(key: string, date: string, now = Date.now()): boolean {
    const s = this.state.get(key);
    if (!s || s.date !== date) return true;
    return s.failures <= RETRY_WAIT_MINUTES.length && now >= s.nextAt;
  }

  /** Records a failure; returns when the next try is allowed (null = not again today). */
  failed(key: string, date: string, now = Date.now()): Date | null {
    const prev = this.state.get(key);
    const failures = prev && prev.date === date ? prev.failures + 1 : 1;
    const wait = RETRY_WAIT_MINUTES[failures - 1];
    const nextAt = wait === undefined ? Number.POSITIVE_INFINITY : now + wait * 60_000;
    this.state.set(key, { date, failures, nextAt });
    return wait === undefined ? null : new Date(nextAt);
  }

  succeeded(key: string) {
    this.state.delete(key);
  }
}
