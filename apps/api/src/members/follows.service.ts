import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, count, desc, eq, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Db, DRIZZLE } from "../db/db.module";
import { follow, profile, user } from "../db/schema";

export interface FollowCounts {
  /** Mutual follows — the product's definition of "friends". */
  friends: number;
  followers: number;
  following: number;
}

/** One row of a friends list (avatar still an S3 key; the members service presigns it). */
export interface FriendRow {
  userId: string;
  username: string | null;
  displayName: string;
  avatarKey: string | null;
  isFollowing: boolean;
}

export interface FriendsPage {
  items: FriendRow[];
  total: number;
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

  /**
   * Friends of `userId` (mutual follows), newest friendship first, with whether the
   * viewer already follows each of them.
   */
  async friends(
    userId: string,
    viewerId: string,
    limit: number,
    offset: number,
  ): Promise<FriendsPage> {
    const back = alias(follow, "back");
    const viewerFollow = alias(follow, "viewer_follow");
    const rows = await this.db
      .select({
        userId: user.id,
        username: user.username,
        displayName: profile.displayName,
        avatarKey: profile.avatarKey,
        isFollowing: sql<boolean>`${viewerFollow.followerId} is not null`,
      })
      .from(follow)
      .innerJoin(
        back,
        and(eq(back.followerId, follow.followingId), eq(back.followingId, follow.followerId)),
      )
      .innerJoin(user, eq(user.id, follow.followingId))
      .innerJoin(profile, eq(profile.userId, user.id))
      .leftJoin(
        viewerFollow,
        and(eq(viewerFollow.followerId, viewerId), eq(viewerFollow.followingId, user.id)),
      )
      .where(eq(follow.followerId, userId))
      .orderBy(desc(back.createdAt))
      .limit(limit)
      .offset(offset);
    const total = await this.friendsCount(userId);
    return { items: rows.map((r) => ({ ...r, isFollowing: Boolean(r.isFollowing) })), total };
  }

  /** Friends `userId` and the viewer have in common. The viewer follows all of them by definition. */
  async mutualFriends(
    userId: string,
    viewerId: string,
    limit: number,
    offset: number,
  ): Promise<FriendsPage> {
    const back = alias(follow, "back");
    const vf = alias(follow, "viewer_forward");
    const vb = alias(follow, "viewer_back");
    const base = () =>
      this.db
        .select({
          userId: user.id,
          username: user.username,
          displayName: profile.displayName,
          avatarKey: profile.avatarKey,
        })
        .from(follow)
        .innerJoin(
          back,
          and(eq(back.followerId, follow.followingId), eq(back.followingId, follow.followerId)),
        )
        .innerJoin(vf, and(eq(vf.followerId, viewerId), eq(vf.followingId, follow.followingId)))
        .innerJoin(vb, and(eq(vb.followerId, follow.followingId), eq(vb.followingId, viewerId)))
        .innerJoin(user, eq(user.id, follow.followingId))
        .innerJoin(profile, eq(profile.userId, user.id))
        .where(and(eq(follow.followerId, userId), ne(follow.followingId, viewerId)));
    const rows = await base().orderBy(desc(back.createdAt)).limit(limit).offset(offset);
    const total = await this.mutualFriendsCount(userId, viewerId);
    return { items: rows.map((r) => ({ ...r, isFollowing: true })), total };
  }

  async mutualFriendsCount(userId: string, viewerId: string): Promise<number> {
    if (userId === viewerId) return 0;
    const back = alias(follow, "back");
    const vf = alias(follow, "viewer_forward");
    const vb = alias(follow, "viewer_back");
    const [row] = await this.db
      .select({ c: count() })
      .from(follow)
      .innerJoin(
        back,
        and(eq(back.followerId, follow.followingId), eq(back.followingId, follow.followerId)),
      )
      .innerJoin(vf, and(eq(vf.followerId, viewerId), eq(vf.followingId, follow.followingId)))
      .innerJoin(vb, and(eq(vb.followerId, follow.followingId), eq(vb.followingId, viewerId)))
      .where(and(eq(follow.followerId, userId), ne(follow.followingId, viewerId)));
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
