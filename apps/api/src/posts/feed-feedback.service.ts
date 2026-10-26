/**
 * What a member tells the feed without a like: which posts it has shown them
 * (seen), and the ones they don't want ("Not interested"). For You ranks with
 * both (feed-ranking.ts); docs/MATCHING.md, "Feed".
 */
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { Db, DRIZZLE } from "../db/db.module";
import { post, postNotInterested, postSeen } from "../db/schema";

/** One report of the cards a feed showed: at most this many posts. */
export const SEEN_BATCH_MAX = 50;
/** Seen rows not seen again for this long are cleared. */
export const SEEN_KEEP_DAYS = 30;
/** How often a report also clears the old rows. */
const SWEEP_CHANCE = 0.05;

export const seenSchema = z
  .object({ ids: z.array(z.string().uuid()).min(1).max(SEEN_BATCH_MAX) })
  .strict();

@Injectable()
export class FeedFeedbackService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  /**
   * The feed showed these posts: each counts once more. Ids of posts that are
   * gone are left out rather than failing the rest.
   */
  async seen(userId: string, ids: string[]): Promise<{ seen: number }> {
    const unique = [...new Set(ids)];
    const live = await this.db.select({ id: post.id }).from(post).where(inArray(post.id, unique));
    if (live.length) {
      await this.db
        .insert(postSeen)
        .values(live.map((p) => ({ userId, postId: p.id })))
        .onConflictDoUpdate({
          target: [postSeen.userId, postSeen.postId],
          set: { times: sql`${postSeen.times} + 1`, lastSeenAt: sql`now()` },
        });
    }
    if (Math.random() < SWEEP_CHANCE) {
      await this.db
        .delete(postSeen)
        .where(lt(postSeen.lastSeenAt, sql`now() - make_interval(days => ${SEEN_KEEP_DAYS})`));
    }
    return { seen: live.length };
  }

  /** "Not interested": a repost counts as the post it shows. Never the member's own. */
  async notInterested(userId: string, postId: string): Promise<{ postId: string }> {
    const target = await this.contentOf(postId);
    if (!target) throw new NotFoundException("Post not found");
    if (target.authorId === userId) throw new BadRequestException("That's your own post");
    await this.db
      .insert(postNotInterested)
      .values({ userId, postId: target.id, authorId: target.authorId })
      .onConflictDoNothing();
    return { postId: target.id };
  }

  /** Undo, from the toast: the post can show again. */
  async undoNotInterested(userId: string, postId: string): Promise<{ postId: string }> {
    const target = await this.contentOf(postId);
    const id = target?.id ?? postId;
    await this.db
      .delete(postNotInterested)
      .where(and(eq(postNotInterested.userId, userId), eq(postNotInterested.postId, id)));
    return { postId: id };
  }

  /** The post a card shows: the post itself, or a repost's original. */
  private async contentOf(postId: string): Promise<{ id: string; authorId: string } | null> {
    const [row] = await this.db
      .select({ id: post.id, authorId: post.authorId, repostOfId: post.repostOfId })
      .from(post)
      .where(eq(post.id, postId));
    if (!row) return null;
    if (!row.repostOfId) return { id: row.id, authorId: row.authorId };
    const [original] = await this.db
      .select({ id: post.id, authorId: post.authorId })
      .from(post)
      .where(eq(post.id, row.repostOfId));
    return original ?? null;
  }
}
