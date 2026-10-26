/**
 * The posts a feed has shown, reported a batch at a time (docs/MATCHING.md,
 * "Feed"): each post once per visit of the feed, so scrolling costs a request
 * every few seconds at most rather than one per card. Best effort: a report
 * that fails only means a post isn't lowered next time.
 */

/** The API takes at most this many posts per report. */
export const SEEN_BATCH_MAX = 50;
/** How often what's waiting is reported while the feed is open. */
export const SEEN_FLUSH_MS = 10_000;

export interface SeenBatcher {
  /** A card was on screen long enough to count. */
  add(postId: string): void;
  /** Report what's waiting: on a timer, and when the page is hidden or left. */
  flush(): void;
}

export function createSeenBatcher(send: (ids: string[]) => Promise<unknown>): SeenBatcher {
  const counted = new Set<string>();
  let waiting: string[] = [];
  const flush = () => {
    while (waiting.length) {
      const ids = waiting.slice(0, SEEN_BATCH_MAX);
      waiting = waiting.slice(SEEN_BATCH_MAX);
      void send(ids).catch(() => undefined);
    }
  };
  return {
    add(postId) {
      if (counted.has(postId)) return;
      counted.add(postId);
      waiting.push(postId);
      if (waiting.length >= SEEN_BATCH_MAX) flush();
    },
    flush,
  };
}
