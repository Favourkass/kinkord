/**
 * People you may know: what "Kinksters Near You" adds to matching v1's score
 * (docs/MATCHING.md). Who the viewer knows (mutual friends, who follows them,
 * who reacts to their posts), a lift for members in their first week, and a
 * cap on how often any one member is suggested, so the same few faces don't
 * fill every strip. Each card says why it's there, when the viewer may know it.
 *
 * Pure rules with no database: MembersService gathers the signals.
 */

import { matchScore, type MatchCandidate, type MatchViewer } from "./matching";

/** Every weight in one place; docs/MATCHING.md explains them, so change both together. */
export const SOCIAL = {
  /** Per accepted friend the two have in common... */
  mutualFriend: 3,
  /** ...up to this. */
  mutualFriendsCap: 12,
  /** They follow the viewer, who doesn't follow them back. */
  followsYou: 6,
  /** Per member the viewer follows who follows them... */
  followedByYourFollow: 1,
  followedByYourFollowsCap: 3,
  /** They liked or commented on the viewer's posts lately. */
  theyReacted: 2,
  /** The viewer liked or commented on theirs. */
  youReacted: 2,
  /** They joined in the last NEWCOMER_DAYS. */
  newcomer: 4,
} as const;

/** How long a member counts as new, from when they joined (as For You counts them). */
export const NEWCOMER_DAYS = 7;
/** How far back reactions count. */
export const REACTED_DAYS = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

/** What the viewer's connections say about one candidate. */
export interface SocialSignals {
  /** Accepted friends the two have in common. */
  mutualFriends: number;
  followsYou: boolean;
  /** Members the viewer follows who follow them. */
  followedByYourFollows: number;
  /** They liked the viewer's posts lately. */
  likedYourPosts: boolean;
  /** They commented on the viewer's posts lately. */
  commentedOnYourPosts: boolean;
  /** The viewer liked or commented on their posts lately. */
  youReacted: boolean;
  joinedAt: Date;
}

export interface SocialParts {
  mutualFriends: number;
  followsYou: number;
  followedByYourFollows: number;
  reacted: number;
  newcomer: number;
}

export function isNewcomer(joinedAt: Date, now: Date): boolean {
  const age = now.getTime() - joinedAt.getTime();
  return age >= 0 && age <= NEWCOMER_DAYS * DAY_MS;
}

/** The social parts of the score, part by part. */
export function socialParts(s: SocialSignals, now: Date): SocialParts {
  return {
    mutualFriends: Math.min(s.mutualFriends * SOCIAL.mutualFriend, SOCIAL.mutualFriendsCap),
    followsYou: s.followsYou ? SOCIAL.followsYou : 0,
    followedByYourFollows: Math.min(
      s.followedByYourFollows * SOCIAL.followedByYourFollow,
      SOCIAL.followedByYourFollowsCap,
    ),
    reacted:
      (s.likedYourPosts || s.commentedOnYourPosts ? SOCIAL.theyReacted : 0) +
      (s.youReacted ? SOCIAL.youReacted : 0),
    newcomer: isNewcomer(s.joinedAt, now) ? SOCIAL.newcomer : 0,
  };
}

export const socialScore = (s: SocialSignals, now: Date): number => {
  const p = socialParts(s, now);
  return p.mutualFriends + p.followsYou + p.followedByYourFollows + p.reacted + p.newcomer;
};

/**
 * Best first: matching v1's score plus the social parts, scaled down for a
 * member suggested too often lately. Ties as matching v1's: most recently
 * seen, then the newest account, then the id.
 */
export function rankPeople<T extends MatchCandidate>(
  viewer: MatchViewer,
  candidates: readonly T[],
  signalsOf: (candidate: T) => SocialSignals,
  timesShown: (candidate: T) => number,
  now: Date,
): T[] {
  return candidates
    .map((candidate) => ({
      candidate,
      score: withExposure(
        matchScore(viewer, candidate, now) + socialScore(signalsOf(candidate), now),
        timesShown(candidate),
      ),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.candidate.lastSeenAt?.getTime() ?? 0) - (a.candidate.lastSeenAt?.getTime() ?? 0) ||
        b.candidate.createdAt.getTime() - a.candidate.createdAt.getTime() ||
        a.candidate.userId.localeCompare(b.candidate.userId),
    )
    .map(({ candidate }) => candidate);
}

// ---- exposure ---------------------------------------------------------------

/**
 * How often one member may be suggested before their score is scaled down:
 * up to `softCap` times in `windowMs` they rank as they are; past it, by
 * softCap / times (twice as often counts half).
 */
export const EXPOSURE = {
  windowMs: 6 * 60 * 60 * 1000,
  softCap: 40,
  /** The most members tracked; the least recently suggested are forgotten first. */
  maxTracked: 20_000,
} as const;

export function exposureFactor(times: number): number {
  return times <= EXPOSURE.softCap ? 1 : EXPOSURE.softCap / times;
}

/**
 * Applies the exposure factor to a score: a positive score is scaled down; a
 * negative one (a poor match) is left as it is rather than raised toward 0.
 */
export const withExposure = (score: number, times: number): number =>
  score > 0 ? score * exposureFactor(times) : score;

/**
 * Counts how often each member was suggested in the last window, in hourly
 * buckets, in memory: each API instance counts its own share, and a deploy
 * starts afresh. Approximate on purpose; it only has to stop the same faces
 * filling every strip.
 */
export class ExposureCounter {
  private readonly shown = new Map<string, Map<number, number>>();

  constructor(private readonly window = EXPOSURE) {}

  private bucket(now: Date): number {
    return Math.floor(now.getTime() / (60 * 60 * 1000));
  }

  /** These members were just suggested. */
  record(ids: readonly string[], now = new Date()): void {
    const at = this.bucket(now);
    for (const id of ids) {
      const buckets = this.shown.get(id) ?? new Map<number, number>();
      buckets.set(at, (buckets.get(at) ?? 0) + 1);
      // Re-inserted, so the map stays in order of the most recent suggestion.
      this.shown.delete(id);
      this.shown.set(id, buckets);
    }
    while (this.shown.size > this.window.maxTracked) {
      const oldest = this.shown.keys().next().value as string;
      this.shown.delete(oldest);
    }
  }

  /** Forget everything counted so far. */
  clear(): void {
    this.shown.clear();
  }

  /** How often a member was suggested within the window. */
  times(id: string, now = new Date()): number {
    const buckets = this.shown.get(id);
    if (!buckets) return 0;
    const from = this.bucket(new Date(now.getTime() - this.window.windowMs));
    let total = 0;
    for (const [at, n] of buckets) {
      if (at > from) total += n;
      else buckets.delete(at);
    }
    return total;
  }
}

// ---- the reason on the card ---------------------------------------------------

export type SuggestionReason =
  | { kind: "mutualFriends"; count: number }
  | { kind: "followsYou" }
  | { kind: "likesYourPosts" }
  | { kind: "commentsOnYourPosts" }
  | { kind: "newcomer" }
  | { kind: "sharedKinks"; count: number };

/**
 * The one reason a card gives, the strongest the viewer may know. Mutual
 * friends only when the member lets the viewer see their connections (as the
 * profile's own count); shared kinks only count kinks the viewer can read.
 */
export function reasonFor(
  s: SocialSignals & { canSeeConnections: boolean; sharedKinks: number },
  now: Date,
): SuggestionReason | null {
  if (s.mutualFriends > 0 && s.canSeeConnections) {
    return { kind: "mutualFriends", count: s.mutualFriends };
  }
  if (s.followsYou) return { kind: "followsYou" };
  if (s.likedYourPosts) return { kind: "likesYourPosts" };
  if (s.commentedOnYourPosts) return { kind: "commentsOnYourPosts" };
  if (isNewcomer(s.joinedAt, now)) return { kind: "newcomer" };
  if (s.sharedKinks >= 2) return { kind: "sharedKinks", count: s.sharedKinks };
  return null;
}
