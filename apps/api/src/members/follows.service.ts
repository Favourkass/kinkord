import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, count, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Db, DRIZZLE } from "../db/db.module";
import { follow, user } from "../db/schema";

export interface FollowCounts {
  /** Mutual follows — the product's definition of "friends". */
  friends: number;
  followers: number;
  following: number;
}

/**
 * Follow is the single social action. Following is one-directional; when two
 * members follow each other they are friends. No request/accept flow.
 */
@Injectable()
export class FollowsService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async follow(viewerId: string, username: string) {
    const targetId = await this.resolveUserId(username);
    if (targetId === viewerId) throw new BadRequestException("You can’t follow yourself.");
    await this.db
      .insert(follow)
      .values({ followerId: viewerId, followingId: targetId })
      .onConflictDoNothing();
    return { following: true, followersCount: await this.followersCount(targetId) };
  }

  async unfollow(viewerId: string, username: string) {
    const targetId = await this.resolveUserId(username);
    await this.db
      .delete(follow)
      .where(and(eq(follow.followerId, viewerId), eq(follow.followingId, targetId)));
    return { following: false, followersCount: await this.followersCount(targetId) };
  }

  async isFollowing(viewerId: string, targetId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ followerId: follow.followerId })
      .from(follow)
      .where(and(eq(follow.followerId, viewerId), eq(follow.followingId, targetId)))
      .limit(1);
    return Boolean(row);
  }

  async followersCount(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ c: count() })
      .from(follow)
      .where(eq(follow.followingId, userId));
    return Number(row?.c ?? 0);
  }

  async followingCount(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ c: count() })
      .from(follow)
      .where(eq(follow.followerId, userId));
    return Number(row?.c ?? 0);
  }

  /** Friends = members `userId` follows who also follow `userId` back. */
  async friendsCount(userId: string): Promise<number> {
    const back = alias(follow, "back");
    const [row] = await this.db
      .select({ c: count() })
      .from(follow)
      .innerJoin(
        back,
        and(eq(back.followerId, follow.followingId), eq(back.followingId, follow.followerId)),
      )
      .where(eq(follow.followerId, userId));
    return Number(row?.c ?? 0);
  }

  async counts(userId: string): Promise<FollowCounts> {
    const [friends, followers, following] = await Promise.all([
      this.friendsCount(userId),
      this.followersCount(userId),
      this.followingCount(userId),
    ]);
    return { friends, followers, following };
  }

  /** Usernames are stored lowercase by the username plugin; accept "@Handle" too. */
  async resolveUserId(username: string): Promise<string> {
    const handle = username.replace(/^@/, "").toLowerCase();
    const [row] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.username, handle))
      .limit(1);
    if (!row) throw new NotFoundException("Member not found.");
    return row.id;
  }
}
