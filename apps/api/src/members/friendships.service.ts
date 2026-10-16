import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, ne, or } from "drizzle-orm";
import { DRIZZLE, type Db } from "../db/db.module";
import { friendship, profile, user } from "../db/schema";
import { notBanned } from "../moderation/admins";
import { noBlockEitherWay } from "../safety/blocks";
import { PushService } from "../push/push.service";
import { StorageService } from "../storage/storage.service";
import { FollowsService } from "./follows.service";
import { friendshipState, orderedPair } from "./friendship-policy";

@Injectable()
export class FriendshipsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly follows: FollowsService,
    private readonly push: PushService,
    private readonly storage: StorageService,
  ) {}

  private async target(viewerId: string, username: string) {
    const targetId = await this.follows.resolveUserId(username);
    if (viewerId === targetId) throw new BadRequestException("You can't add yourself as a friend.");
    const [available] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, targetId), notBanned(user.id), noBlockEitherWay(user.id, viewerId)))
      .limit(1);
    if (!available) throw new NotFoundException("Member not found.");
    return targetId;
  }

  private pairWhere(a: string, b: string) {
    const pair = orderedPair(a, b);
    return and(eq(friendship.userA, pair.userA), eq(friendship.userB, pair.userB));
  }

  async state(viewerId: string, targetId: string) {
    const [row] = await this.db
      .select()
      .from(friendship)
      .where(this.pairWhere(viewerId, targetId))
      .limit(1);
    return { friendship: friendshipState(row, viewerId) };
  }

  async request(viewerId: string, username: string) {
    const targetId = await this.target(viewerId, username);
    const added = await this.db
      .insert(friendship)
      .values({ ...orderedPair(viewerId, targetId), requesterId: viewerId })
      .onConflictDoNothing()
      .returning({ id: friendship.id });
    // The pair's unique key makes duplicate/crossed requests idempotent. A crossed request is not acceptance.
    if (added.length) this.push.friendRequest(viewerId, targetId, added[0].id);
    return this.state(viewerId, targetId);
  }

  async accept(viewerId: string, username: string) {
    const targetId = await this.target(viewerId, username);
    const updated = await this.db
      .update(friendship)
      .set({ status: "accepted", acceptedAt: new Date() })
      .where(
        and(
          this.pairWhere(viewerId, targetId),
          eq(friendship.status, "pending"),
          eq(friendship.requesterId, targetId),
        ),
      )
      .returning({ id: friendship.id });
    if (updated.length) this.push.friendAccepted(viewerId, targetId, updated[0].id);
    const state = await this.state(viewerId, targetId);
    if (!updated.length && state.friendship !== "friends")
      throw new ForbiddenException("Only the recipient can accept a pending friend request.");
    return state;
  }

  /** Sender cancels; recipient declines. Neither action changes follows or accepted friendships. */
  async dismiss(viewerId: string, username: string) {
    const targetId = await this.follows.resolveUserId(username);
    await this.db
      .delete(friendship)
      .where(and(this.pairWhere(viewerId, targetId), eq(friendship.status, "pending")));
    return this.state(viewerId, targetId);
  }

  async remove(viewerId: string, username: string) {
    const targetId = await this.follows.resolveUserId(username);
    await this.db
      .delete(friendship)
      .where(and(this.pairWhere(viewerId, targetId), eq(friendship.status, "accepted")));
    return this.state(viewerId, targetId);
  }

  async requests(viewerId: string, direction: "incoming" | "outgoing", page = 1) {
    const recipient = direction === "incoming";
    const rows = await this.db
      .select({
        id: friendship.id,
        userId: user.id,
        username: user.username,
        displayName: profile.displayName,
        avatarKey: profile.avatarKey,
        createdAt: friendship.createdAt,
      })
      .from(friendship)
      .innerJoin(
        user,
        and(
          or(eq(friendship.userA, user.id), eq(friendship.userB, user.id)),
          ne(user.id, viewerId),
        ),
      )
      .innerJoin(profile, eq(profile.userId, user.id))
      .where(
        and(
          or(eq(friendship.userA, viewerId), eq(friendship.userB, viewerId)),
          eq(friendship.status, "pending"),
          recipient ? ne(friendship.requesterId, viewerId) : eq(friendship.requesterId, viewerId),
          notBanned(user.id),
          noBlockEitherWay(user.id, viewerId),
        ),
      )
      .orderBy(desc(friendship.createdAt), desc(friendship.id))
      .limit(21)
      .offset((page - 1) * 20);
    return {
      items: await Promise.all(
        rows.slice(0, 20).map(async ({ avatarKey, createdAt, ...row }) => ({
          ...row,
          avatarUrl: avatarKey ? await this.storage.presignDownload(avatarKey, "sm") : null,
          createdAt: createdAt.toISOString(),
        })),
      ),
      hasMore: rows.length > 20,
    };
  }
}
