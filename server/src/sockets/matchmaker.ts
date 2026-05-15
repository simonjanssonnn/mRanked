// In-memory matchmaker. Single-process only — swap for Redis when scaling.
// Window widens over time: start ±50, +25 every 5s, cap ±400.

export type QueueEntry = {
  userId: string;
  username: string;
  socketId: string;
  elo: number;
  mode: string;
  joinedAt: number; // ms epoch
};

// Wide-open by default for an MVP with very few concurrent players.
// Otherwise two users hundreds of ELO apart sit forever in queue.
const WIDEN_START = 400;
const WIDEN_STEP = 200;
const WIDEN_INTERVAL_MS = 2000;
const WIDEN_CAP = 5000;

export function searchRangeFor(joinedAt: number, now: number): number {
  const waitedMs = Math.max(0, now - joinedAt);
  const steps = Math.floor(waitedMs / WIDEN_INTERVAL_MS);
  return Math.min(WIDEN_CAP, WIDEN_START + steps * WIDEN_STEP);
}

export class Matchmaker {
  private queue = new Map<string, QueueEntry>(); // keyed by userId
  private onMatch: (a: QueueEntry, b: QueueEntry) => void;
  private intervalHandle: NodeJS.Timeout | null = null;

  constructor(onMatch: (a: QueueEntry, b: QueueEntry) => void) {
    this.onMatch = onMatch;
  }

  start() {
    if (this.intervalHandle) return;
    this.intervalHandle = setInterval(() => this.tick(), 500);
  }

  stop() {
    if (this.intervalHandle) clearInterval(this.intervalHandle);
    this.intervalHandle = null;
  }

  join(entry: QueueEntry) {
    this.queue.set(entry.userId, entry);
  }

  leave(userId: string) {
    this.queue.delete(userId);
  }

  has(userId: string): boolean {
    return this.queue.has(userId);
  }

  size(): number {
    return this.queue.size;
  }

  /** Returns current widening window for a queued user, or null if not queued. */
  rangeFor(userId: string): number | null {
    const e = this.queue.get(userId);
    if (!e) return null;
    return searchRangeFor(e.joinedAt, Date.now());
  }

  private tick() {
    const now = Date.now();
    const entries = Array.from(this.queue.values());

    // Group by mode; match within mode only.
    const byMode = new Map<string, QueueEntry[]>();
    for (const e of entries) {
      const arr = byMode.get(e.mode) ?? [];
      arr.push(e);
      byMode.set(e.mode, arr);
    }

    for (const [, group] of byMode) {
      // Sort by joinedAt — oldest waiters get priority.
      group.sort((x, y) => x.joinedAt - y.joinedAt);

      const matched = new Set<string>();
      for (let i = 0; i < group.length; i++) {
        const a = group[i];
        if (matched.has(a.userId)) continue;

        // Find the best partner for `a`: closest ELO within either's widened range.
        let best: { entry: QueueEntry; diff: number } | null = null;
        for (let j = i + 1; j < group.length; j++) {
          const b = group[j];
          if (matched.has(b.userId)) continue;
          const diff = Math.abs(a.elo - b.elo);
          const rangeA = searchRangeFor(a.joinedAt, now);
          const rangeB = searchRangeFor(b.joinedAt, now);
          const acceptable = diff <= Math.max(rangeA, rangeB);
          if (!acceptable) continue;
          if (!best || diff < best.diff) best = { entry: b, diff };
        }

        if (best) {
          matched.add(a.userId);
          matched.add(best.entry.userId);
          this.queue.delete(a.userId);
          this.queue.delete(best.entry.userId);
          this.onMatch(a, best.entry);
        }
      }
    }
  }
}
