import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, desc, eq, inArray, or, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import { DRIZZLE, type Db } from "../db/db.module";
import { memberGroup, groupMember, groupPost, user, profile } from "../db/schema";
import { acceptedFriendship } from "../members/friendship-policy";
import { noBlockEitherWay } from "../safety/blocks";
import { notBanned } from "../moderation/admins";
import { privacyAllows } from "../privacy/privacy-policy";
import { containsPattern } from "../push/notifications.service";
import { PostsService } from "../posts/posts.service";

export const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  friends: z.array(z.string().min(1).max(128)).max(50).default([]),
});
export const groupShareSchema = z.object({
  postId: z.string().uuid(),
  caption: z.string().trim().max(2000).default(""),
});

@Injectable()
export class GroupsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly posts: PostsService,
  ) {}

  async friends(viewerId: string, query = "") {
    const pattern = containsPattern(query.trim().slice(0, 64));
    return this.db
      .select({ userId: user.id, username: user.username, displayName: profile.displayName })
      .from(user)
      .innerJoin(profile, eq(profile.userId, user.id))
      .where(
        and(
          acceptedFriendship(viewerId, user.id),
          noBlockEitherWay(user.id, viewerId),
          notBanned(user.id),
          privacyAllows(viewerId, user.id, "messaging"),
          or(ilike(user.username, pattern), ilike(profile.displayName, pattern)),
        ),
      )
      .orderBy(asc(profile.displayName), asc(user.id))
      .limit(50);
  }

  async list(viewerId: string) {
    return this.db
      .select({
        id: memberGroup.id,
        name: memberGroup.name,
        ownerId: memberGroup.ownerId,
        status: groupMember.status,
      })
      .from(groupMember)
      .innerJoin(memberGroup, eq(memberGroup.id, groupMember.groupId))
      .where(
        and(
          eq(groupMember.userId, viewerId),
          notBanned(memberGroup.ownerId),
          noBlockEitherWay(memberGroup.ownerId, viewerId),
        ),
      )
      .orderBy(desc(memberGroup.createdAt))
      .limit(100);
  }

  async create(viewerId: string, input: z.infer<typeof createGroupSchema>) {
    const ids = [...new Set(input.friends)].filter((id) => id !== viewerId);
    if (ids.length) {
      const allowed = await this.db
        .select({ id: user.id })
        .from(user)
        .where(
          and(
            inArray(user.id, ids),
            acceptedFriendship(viewerId, user.id),
            noBlockEitherWay(user.id, viewerId),
            notBanned(user.id),
            privacyAllows(viewerId, user.id, "messaging"),
          ),
        );
      if (allowed.length !== ids.length)
        throw new ForbiddenException("Invite only friends who allow you to contact them.");
    }
    return this.db.transaction(async (tx) => {
      // Serialize group creation for a member so simultaneous requests cannot bypass the cap.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${viewerId}, 0))`);
      const owned = await tx
        .select({ id: memberGroup.id })
        .from(memberGroup)
        .where(eq(memberGroup.ownerId, viewerId))
        .limit(20);
      if (owned.length >= 20) throw new BadRequestException("You can own up to 20 groups.");
      const [group] = await tx
        .insert(memberGroup)
        .values({ name: input.name, ownerId: viewerId })
        .returning();
      await tx
        .insert(groupMember)
        .values([
          { groupId: group.id, userId: viewerId, status: "joined" as const },
          ...ids.map((userId) => ({ groupId: group.id, userId, status: "invited" as const })),
        ]);
      return { id: group.id, name: group.name, ownerId: viewerId, status: "joined" as const };
    });
  }

  async requireMember(viewerId: string, groupId: string) {
    const [group] = await this.db
      .select({ id: memberGroup.id, name: memberGroup.name, ownerId: memberGroup.ownerId })
      .from(memberGroup)
      .innerJoin(groupMember, eq(groupMember.groupId, memberGroup.id))
      .where(
        and(
          eq(memberGroup.id, groupId),
          eq(groupMember.userId, viewerId),
          eq(groupMember.status, "joined"),
          notBanned(memberGroup.ownerId),
          noBlockEitherWay(memberGroup.ownerId, viewerId),
        ),
      )
      .limit(1);
    if (!group) throw new NotFoundException("Group not found.");
    return { ...group, isOwner: group.ownerId === viewerId };
  }

  async invite(viewerId: string, groupId: string, friends: string[]) {
    const group = await this.requireMember(viewerId, groupId);
    if (group.ownerId !== viewerId)
      throw new ForbiddenException("Only the owner can invite friends.");
    const ids = [...new Set(friends)].filter((id) => id !== viewerId);
    if (!ids.length) throw new BadRequestException("Choose friends to invite.");
    const allowed = await this.db
      .select({ id: user.id })
      .from(user)
      .where(
        and(
          inArray(user.id, ids),
          acceptedFriendship(viewerId, user.id),
          noBlockEitherWay(user.id, viewerId),
          notBanned(user.id),
          privacyAllows(viewerId, user.id, "messaging"),
        ),
      );
    if (allowed.length !== ids.length)
      throw new ForbiddenException("Invite only friends who allow you to contact them.");
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${groupId}, 0))`);
      const members = await tx
        .select({ userId: groupMember.userId })
        .from(groupMember)
        .where(eq(groupMember.groupId, groupId));
      const added = ids.filter((id) => !members.some((m) => m.userId === id));
      if (members.length + added.length > 100)
        throw new BadRequestException("Groups can have up to 100 members and invitations.");
      if (added.length)
        await tx
          .insert(groupMember)
          .values(added.map((userId) => ({ groupId, userId, status: "invited" as const })))
          .onConflictDoNothing();
    });
    return { ok: true };
  }

  async removeMember(viewerId: string, groupId: string, memberId: string) {
    const group = await this.requireMember(viewerId, groupId);
    if (group.ownerId !== viewerId || memberId === viewerId)
      throw new ForbiddenException("Only the owner can remove other members.");
    await this.db
      .delete(groupMember)
      .where(and(eq(groupMember.groupId, groupId), eq(groupMember.userId, memberId)));
    return { ok: true };
  }

  async accept(viewerId: string, groupId: string) {
    const group = (await this.list(viewerId)).find(
      (g) => g.id === groupId && g.status === "invited",
    );
    if (!group) throw new NotFoundException("Invitation not found.");
    await this.db
      .update(groupMember)
      .set({ status: "joined" })
      .where(and(eq(groupMember.groupId, groupId), eq(groupMember.userId, viewerId)));
    return { ok: true };
  }

  async leave(viewerId: string, groupId: string) {
    const [group] = await this.db
      .select()
      .from(memberGroup)
      .where(eq(memberGroup.id, groupId))
      .limit(1);
    if (group?.ownerId === viewerId)
      throw new BadRequestException("The owner must delete the group instead of leaving.");
    await this.db
      .delete(groupMember)
      .where(and(eq(groupMember.groupId, groupId), eq(groupMember.userId, viewerId)));
    return { ok: true };
  }

  async remove(viewerId: string, groupId: string) {
    const [removed] = await this.db
      .delete(memberGroup)
      .where(and(eq(memberGroup.id, groupId), eq(memberGroup.ownerId, viewerId)))
      .returning({ id: memberGroup.id });
    if (!removed) throw new NotFoundException("Group not found.");
    return { ok: true };
  }

  async share(viewerId: string, groupId: string, input: z.infer<typeof groupShareSchema>) {
    await this.requireMember(viewerId, groupId);
    const original = await this.posts.shareablePost(input.postId, viewerId);
    const [entry] = await this.db
      .insert(groupPost)
      .values({ groupId, postId: original.postId, authorId: viewerId, caption: input.caption })
      .onConflictDoNothing()
      .returning({ id: groupPost.id });
    if (!entry) throw new BadRequestException("You have already shared this post to this group.");
    const counts = await this.posts
      .share(original.postId, viewerId)
      .catch(() => ({ postId: original.postId, shares: original.shares }));
    return { ...counts, id: entry.id };
  }

  async feed(viewerId: string, groupId: string, page: number) {
    const group = await this.requireMember(viewerId, groupId);
    const members = await this.db
      .select({ id: groupMember.userId, name: profile.displayName, status: groupMember.status })
      .from(groupMember)
      .innerJoin(profile, eq(profile.userId, groupMember.userId))
      .where(
        and(
          eq(groupMember.groupId, groupId),
          noBlockEitherWay(groupMember.userId, viewerId),
          notBanned(groupMember.userId),
          ...(group.isOwner ? [] : [eq(groupMember.status, "joined")]),
        ),
      )
      .orderBy(asc(profile.displayName));
    const rows = await this.db
      .select({
        id: groupPost.id,
        postId: groupPost.postId,
        caption: groupPost.caption,
        authorId: groupPost.authorId,
        name: profile.displayName,
        createdAt: groupPost.createdAt,
      })
      .from(groupPost)
      .innerJoin(profile, eq(profile.userId, groupPost.authorId))
      .where(
        and(
          eq(groupPost.groupId, groupId),
          noBlockEitherWay(groupPost.authorId, viewerId),
          notBanned(groupPost.authorId),
        ),
      )
      .orderBy(desc(groupPost.createdAt), desc(groupPost.id))
      .limit(21)
      .offset((page - 1) * 20);
    const items = await Promise.all(
      rows.slice(0, 20).map(async (row) => {
        // Re-check original visibility and sharing privacy on every read.
        let item;
        try {
          item = await this.posts.shareablePost(row.postId, viewerId);
        } catch (error) {
          if (error instanceof NotFoundException || error instanceof ForbiddenException)
            return null;
          throw error;
        }
        return {
          id: row.id,
          caption: row.caption,
          sharedBy: row.name ?? "Member",
          createdAt: row.createdAt.toISOString(),
          canRemove: row.authorId === viewerId || group.ownerId === viewerId,
          post: item,
        };
      }),
    );
    return {
      group,
      members: members.map((member) => ({
        ...member,
        canRemove: group.isOwner && member.id !== viewerId,
      })),
      items: items.filter((item) => item !== null),
      nextPage: rows.length > 20 ? page + 1 : null,
    };
  }

  async removePost(viewerId: string, groupId: string, id: string) {
    const group = await this.requireMember(viewerId, groupId);
    const [removed] = await this.db
      .delete(groupPost)
      .where(
        and(
          eq(groupPost.id, id),
          eq(groupPost.groupId, groupId),
          ...(group.ownerId === viewerId ? [] : [eq(groupPost.authorId, viewerId)]),
        ),
      )
      .returning({ id: groupPost.id });
    if (!removed) throw new NotFoundException("Shared post not found.");
    return { ok: true };
  }
}
