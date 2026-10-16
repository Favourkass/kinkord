import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, count, desc, eq, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Db, DRIZZLE } from "../db/db.module";
import { PushService } from "../push/push.service";
import { follow, friendship, profile, user } from "../db/schema";
import { acceptedFriendship, friendshipState as stateOf, orderedPair } from "./friendship-policy";
import { silverCheck } from "../subscriptions/plans";

export interface FollowCounts {
  /** Accepted friendships, including the legacy friendships preserved at migration. */
  friends: number;
  followers: number;
  following: number;
}

/** One row of a friends list (avatar still an S3 key; the members service presigns it). */
export interface FriendRow {
  friendship?: import("./friendship-policy").FriendshipState;
  userId: string;
  username: string | null;
  displayName: string;
  avatarKey: string | null;
  /** Kept server-side; the members service derives `age` and never leaks the DOB. */
  dateOfBirth: string | null;
  gender: string | null;
  city: string | null;
  state: string | null;
  /** ISO 3166-1 alpha-2: the web names the state by it ("Delta State", but Kenya's "Nairobi"). */
  country: string | null;
  isFollowing: boolean;
  /** Shows the Silver check beside their name. */
  silver: boolean;
}

export interface FriendsPage {
  items: FriendRow[];
  total: number;
}

/** Following and friendship are independent: friend reads use only accepted pairs. */
@Injectable()
export class FollowsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly push: PushService,
  ) {}

  async follow(viewerId: string, username: string) {
    const targetId = await this.resolveUserId(username);
    if (targetId === viewerId) throw new BadRequestException("You can’t follow yourself.");
    const added = await this.db
      .insert(follow)
      .values({ followerId: viewerId, followingId: targetId })
      .onConflictDoNothing()
      .returning({ followerId: follow.followerId });
    // Only a new follow is news: tapping Follow twice notifies once.
    if (added.length > 0) this.push.newFollower(viewerId, targetId);
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

  async friendshipState(viewerId: string, targetId: string) {
    if (viewerId === targetId) return "none" as const;
    const pair = orderedPair(viewerId, targetId);
    const [row] = await this.db
      .select({ status: friendship.status, requesterId: friendship.requesterId })
      .from(friendship)
      .where(and(eq(friendship.userA, pair.userA), eq(friendship.userB, pair.userB)))
      .limit(1);
    return stateOf(row, viewerId);
  }

  async friendsCount(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ c: count() })
      .from(friendship)
      .where(
        and(
          eq(friendship.status, "accepted"),
          or(eq(friendship.userA, userId), eq(friendship.userB, userId)),
        ),
      );
    return Number(row?.c ?? 0);
  }

  async areFriends(a: string, b: string): Promise<boolean> {
    if (a === b) return false;
    const pair = orderedPair(a, b);
    const [row] = await this.db
      .select({ c: count() })
      .from(friendship)
      .where(
        and(
          eq(friendship.userA, pair.userA),
          eq(friendship.userB, pair.userB),
          eq(friendship.status, "accepted"),
        ),
      );
    return Number(row?.c ?? 0) > 0;
  }

  async friends(
    userId: string,
    viewerId: string,
    limit: number,
    offset: number,
  ): Promise<FriendsPage> {
    const viewerFollow = alias(follow, "viewer_follow");
    const peer = sql<string>`case when ${friendship.userA} = ${userId} then ${friendship.userB} else ${friendship.userA} end`;
    const rows = await this.db
      .select({
        userId: user.id,
        username: user.username,
        displayName: profile.displayName,
        avatarKey: profile.avatarKey,
        dateOfBirth: profile.dateOfBirth,
        gender: profile.gender,
        city: profile.city,
        state: profile.state,
        country: profile.country,
        silver: silverCheck(user.id),
        isFollowing: sql<boolean>`${viewerFollow.followerId} is not null`,
      })
      .from(friendship)
      .innerJoin(user, eq(user.id, peer))
      .innerJoin(profile, eq(profile.userId, user.id))
      .leftJoin(
        viewerFollow,
        and(eq(viewerFollow.followerId, viewerId), eq(viewerFollow.followingId, user.id)),
      )
      .where(
        and(
          eq(friendship.status, "accepted"),
          or(eq(friendship.userA, userId), eq(friendship.userB, userId)),
        ),
      )
      .orderBy(desc(friendship.acceptedAt))
      .limit(limit)
      .offset(offset);
    return {
      items: rows.map((r) => ({
        ...r,
        isFollowing: Boolean(r.isFollowing),
        silver: Boolean(r.silver),
      })),
      total: await this.friendsCount(userId),
    };
  }

  /** People who follow `userId`, newest first, with the viewer's follow state on each. */
  async followers(
    userId: string,
    viewerId: string,
    limit: number,
    offset: number,
  ): Promise<FriendsPage> {
    const viewerFollow = alias(follow, "viewer_follow");
    const rows = await this.db
      .select({
        userId: user.id,
        username: user.username,
        displayName: profile.displayName,
        avatarKey: profile.avatarKey,
        dateOfBirth: profile.dateOfBirth,
        gender: profile.gender,
        city: profile.city,
        state: profile.state,
        country: profile.country,
        silver: silverCheck(user.id),
        isFollowing: sql<boolean>`${viewerFollow.followerId} is not null`,
      })
      .from(follow)
      .innerJoin(user, eq(user.id, follow.followerId))
      .innerJoin(profile, eq(profile.userId, user.id))
      .leftJoin(
        viewerFollow,
        and(eq(viewerFollow.followerId, viewerId), eq(viewerFollow.followingId, user.id)),
      )
      .where(eq(follow.followingId, userId))
      .orderBy(desc(follow.createdAt))
      .limit(limit)
      .offset(offset);
    const total = await this.followersCount(userId);
    return {
      items: rows.map((r) => ({
        ...r,
        isFollowing: Boolean(r.isFollowing),
        silver: Boolean(r.silver),
      })),
      total,
    };
  }

  /** People `userId` follows, newest first, with the viewer's follow state on each. */
  async following(
    userId: string,
    viewerId: string,
    limit: number,
    offset: number,
  ): Promise<FriendsPage> {
    const viewerFollow = alias(follow, "viewer_follow");
    const rows = await this.db

      .select({
        userId: user.id,
        username: user.username,
        displayName: profile.displayName,
        avatarKey: profile.avatarKey,
        dateOfBirth: profile.dateOfBirth,
        gender: profile.gender,
        city: profile.city,
        state: profile.state,
        country: profile.country,
        silver: silverCheck(user.id),
        isFollowing: sql<boolean>`${viewerFollow.followerId} is not null`,
      })

      .from(follow)
      .innerJoin(user, eq(user.id, follow.followingId))
      .innerJoin(profile, eq(profile.userId, user.id))
      .leftJoin(
        viewerFollow,
        and(eq(viewerFollow.followerId, viewerId), eq(viewerFollow.followingId, user.id)),
      )
      .where(eq(follow.followerId, userId))
      .orderBy(desc(follow.createdAt))
      .limit(limit)
      .offset(offset);
    const total = await this.followingCount(userId);
    return {
      items: rows.map((r) => ({
        ...r,
        isFollowing: Boolean(r.isFollowing),
        silver: Boolean(r.silver),
      })),
      total,
    };
  }

  /** Accepted friends in common; follow state remains independent. */
  async mutualFriends(
    userId: string,
    viewerId: string,
    limit: number,
    offset: number,
  ): Promise<FriendsPage> {
    if (userId === viewerId) return { items: [], total: 0 };
    const viewerFollow = alias(follow, "viewer_follow");
    const rows = await this.db
      .select({
        userId: user.id,
        username: user.username,
        displayName: profile.displayName,
        avatarKey: profile.avatarKey,
        dateOfBirth: profile.dateOfBirth,
        gender: profile.gender,
        city: profile.city,
        state: profile.state,
        country: profile.country,
        silver: silverCheck(user.id),
        isFollowing: sql<boolean>`${viewerFollow.followerId} is not null`,
      })
      .from(user)
      .innerJoin(profile, eq(profile.userId, user.id))
      .leftJoin(
        viewerFollow,
        and(eq(viewerFollow.followerId, viewerId), eq(viewerFollow.followingId, user.id)),
      )
      .where(
        and(
          acceptedFriendship(userId, user.id),
          acceptedFriendship(viewerId, user.id),
          ne(user.id, viewerId),
          ne(user.id, userId),
        ),
      )
      .orderBy(desc(user.createdAt))
      .limit(limit)
      .offset(offset);
    return {
      items: rows.map((r) => ({
        ...r,
        isFollowing: Boolean(r.isFollowing),
        silver: Boolean(r.silver),
      })),
      total: await this.mutualFriendsCount(userId, viewerId),
    };
  }

  async mutualFriendsCount(userId: string, viewerId: string): Promise<number> {
    if (userId === viewerId) return 0;
    const [row] = await this.db
      .select({ c: count() })
      .from(user)
      .where(
        and(
          acceptedFriendship(userId, user.id),
          acceptedFriendship(viewerId, user.id),
          ne(user.id, viewerId),
          ne(user.id, userId),
        ),
      );
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
