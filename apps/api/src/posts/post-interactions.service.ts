import { teamBadge } from "../members/team-badge";
import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, count, desc, eq, gt, isNull, lt } from "drizzle-orm";
import { z } from "zod";
import { Db, DRIZZLE } from "../db/db.module";
import { PushService } from "../push/push.service";
import {
  groupLog,
  post,
  postComment,
  postLike,
  postSave,
  profile,
  user,
  COMMENT_BODY_MAX,
} from "../db/schema";
import { knownHandles, mentionCandidates, mentionsIn, type Mention } from "./mentions";
import { StorageService } from "../storage/storage.service";
import { silverCheck } from "../subscriptions/plans";
import { groupAccess, membershipOf } from "../groups/group-policy";
import { noBlockEitherWay } from "../safety/blocks";
import {
  clamp,
  parseCursor,
  COMMENT_MAX_PAGE_SIZE,
  COMMENT_PAGE_SIZE,
  PostsService,
  type PostVM,
  type SaveVM,
} from "./posts.service";

/** Said to someone who reads an open group but hasn't joined it. */
export const JOIN_TO_TAKE_PART = "Join the group to take part.";
export const DISCUSSION_CLOSED = "This discussion is closed to new replies.";

/** Replies to a group discussion read oldest first, like a conversation; a feed post's newest first. */
export type CommentOrder = "newest" | "oldest";

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, "Write a comment first.").max(COMMENT_BODY_MAX),
});

export interface CommentVM {
  id: string;
  body: string;
  createdAt: string;
  author: {
    userId: string;
    username: string | null;
    displayName: string;
    avatarUrl: string | null;
    /** Shows the Silver check beside their name. */
    silver: boolean;
    teamMember?: boolean;
  };
  /** Each @handle in the body that names a member, and whom: the ones the app links. */
  mentions: Mention[];
  /** Whether the viewer may delete it: their own comment, or any comment on their post. */
  canDelete: boolean;
}

export interface CommentsVM {
  items: CommentVM[];
  total: number;
  nextCursor: string | null;
}

export interface LikeVM {
  postId: string;
  likes: number;
  likedByMe: boolean;
}

/**
 * Likes and comments.
 *
 * Every method starts by resolving the post through `PostsService.byId`, which
 * applies the same visibility rules as the feed. Without that, a friends-only
 * post could be liked or commented on by anyone who learned its id.
 */
@Injectable()
export class PostInteractionsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly posts: PostsService,
    private readonly storage: StorageService,
    private readonly push: PushService,
  ) {}

  /** Idempotent: the composite primary key is what makes a double tap harmless. */
  async like(postId: string, userId: string): Promise<LikeVM> {
    const authorId = (await this.takingPart(postId, userId)).author.userId;
    const added = await this.db
      .insert(postLike)
      .values({ postId, userId })
      .onConflictDoNothing()
      .returning({ userId: postLike.userId });
    if (added.length) this.push.newLike(postId, authorId, userId);
    return this.likeState(postId, userId);
  }

  async unlike(postId: string, userId: string): Promise<LikeVM> {
    await this.visiblePost(postId, userId);
    await this.db
      .delete(postLike)
      .where(and(eq(postLike.postId, postId), eq(postLike.userId, userId)));
    return this.likeState(postId, userId);
  }

  /**
   * Save a post to read later. Private: the author is never told, and no count
   * is published anywhere, so saving is not a signal anyone can read.
   */
  async save(postId: string, userId: string): Promise<SaveVM> {
    const target = await this.contentPost(postId, userId);
    await this.db.insert(postSave).values({ postId: target, userId }).onConflictDoNothing();
    return { postId: target, savedByMe: true };
  }

  async unsave(postId: string, userId: string): Promise<SaveVM> {
    const target = await this.contentPost(postId, userId);
    await this.db
      .delete(postSave)
      .where(and(eq(postSave.postId, target), eq(postSave.userId, userId)));
    return { postId: target, savedByMe: false };
  }

  /**
   * Newest first, so a fresh comment is the first thing under a fresh post; a
   * group discussion's replies can read oldest first. In a group, a block hides
   * each member's replies from the other, except from the moderators.
   */
  async comments(
    postId: string,
    viewerId: string,
    cursorArg?: string | null,
    limitArg?: number,
    order: CommentOrder = "newest",
  ) {
    const vm = await this.visibleVM(postId, viewerId);
    const authorId = vm.author.userId;
    const moderator = vm.group ? await this.moderates(vm.group.id, viewerId) : false;
    const limit = clamp(limitArg ?? COMMENT_PAGE_SIZE, 1, COMMENT_MAX_PAGE_SIZE);
    const cursor = parseCursor(cursorArg);
    const oldest = order === "oldest";
    const rows = await this.db
      .select({
        id: postComment.id,
        body: postComment.body,
        createdAt: postComment.createdAt,
        authorId: postComment.authorId,
        username: user.username,
        displayName: profile.displayName,
        avatarKey: profile.avatarKey,
        teamMember: teamBadge(postComment.authorId),
        silver: silverCheck(postComment.authorId),
      })
      .from(postComment)
      .innerJoin(user, eq(user.id, postComment.authorId))
      .leftJoin(profile, eq(profile.userId, postComment.authorId))
      .where(
        and(
          eq(postComment.postId, postId),
          isNull(postComment.deletedAt),
          ...(cursor
            ? [oldest ? gt(postComment.createdAt, cursor) : lt(postComment.createdAt, cursor)]
            : []),
          ...(vm.group && !moderator ? [noBlockEitherWay(postComment.authorId, viewerId)] : []),
        ),
      )
      .orderBy(oldest ? asc(postComment.createdAt) : desc(postComment.createdAt))
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    const [totalRow] = await this.db
      .select({ total: count() })
      .from(postComment)
      .where(and(eq(postComment.postId, postId), isNull(postComment.deletedAt)));
    const members = await knownHandles(
      this.db,
      page.flatMap((r) => mentionCandidates(r.body)),
    );
    const items = await Promise.all(
      page.map(async (r) => ({
        id: r.id,
        body: r.body,
        mentions: mentionsIn(r.body, members),
        createdAt: r.createdAt.toISOString(),
        author: {
          userId: r.authorId,
          username: r.username,
          displayName: r.displayName ?? r.username ?? "Member",
          avatarUrl: r.avatarKey ? await this.storage.presignDownload(r.avatarKey, "sm") : null,
          silver: Boolean(r.silver),
          teamMember: Boolean(r.teamMember),
        },
        canDelete: r.authorId === viewerId || authorId === viewerId || moderator,
      })),
    );
    return {
      items,
      total: Number(totalRow?.total ?? 0),
      nextCursor: rows.length > limit ? (page.at(-1)?.createdAt.toISOString() ?? null) : null,
    } satisfies CommentsVM;
  }

  async comment(postId: string, userId: string, body: string): Promise<CommentVM> {
    // Resolved for its visibility check: a post you cannot read, you cannot answer.
    const vm = await this.takingPart(postId, userId);
    if (vm.closed) throw new ForbiddenException(DISCUSSION_CLOSED);
    const authorId = vm.author.userId;
    const [row] = await this.db
      .insert(postComment)
      .values({ postId, authorId: userId, body })
      .returning();
    // A reply brings its discussion back to the top of the group.
    if (vm.group) {
      await this.db.update(post).set({ lastActivityAt: row.createdAt }).where(eq(post.id, postId));
    }
    this.push.newComment(postId, authorId, userId);
    // The post's author hears of the comment already; once is enough.
    this.posts.notifyMentions(postId, userId, body, [authorId]);
    const [me] = await this.db
      .select({
        username: user.username,
        displayName: profile.displayName,
        avatarKey: profile.avatarKey,
        teamMember: teamBadge(user.id),
        silver: silverCheck(user.id),
      })
      .from(user)
      .leftJoin(profile, eq(profile.userId, user.id))
      .where(eq(user.id, userId));
    const members = await knownHandles(this.db, mentionCandidates(row.body));
    return {
      id: row.id,
      body: row.body,
      mentions: mentionsIn(row.body, members),
      createdAt: row.createdAt.toISOString(),
      author: {
        userId: userId,
        username: me?.username ?? null,
        displayName: me?.displayName ?? me?.username ?? "Member",
        avatarUrl: me?.avatarKey ? await this.storage.presignDownload(me.avatarKey, "sm") : null,
        silver: Boolean(me?.silver),
        teamMember: Boolean(me?.teamMember),
      },
      canDelete: true,
    };
  }

  /**
   * A comment can be removed by whoever wrote it, and by whoever owns the post —
   * moderating your own thread is the minimum a member needs.
   */
  async removeComment(commentId: string, userId: string) {
    const [row] = await this.db
      .select({
        commentAuthorId: postComment.authorId,
        postId: post.id,
        postAuthorId: post.authorId,
        groupId: post.groupId,
        deletedAt: postComment.deletedAt,
      })
      .from(postComment)
      .innerJoin(post, eq(post.id, postComment.postId))
      .where(eq(postComment.id, commentId));
    if (!row || row.deletedAt) throw new NotFoundException("Comment not found");
    const own = row.commentAuthorId === userId || row.postAuthorId === userId;
    // A group's moderators look after every reply in it.
    const moderator = !own && row.groupId ? await this.moderates(row.groupId, userId) : false;
    if (!own && !moderator) throw new ForbiddenException("That isn't your comment");
    await this.db
      .update(postComment)
      .set({ deletedAt: new Date() })
      .where(eq(postComment.id, commentId));
    if (moderator && row.groupId) {
      await this.db.insert(groupLog).values({
        groupId: row.groupId,
        actorId: userId,
        subjectUserId: row.commentAuthorId,
        subjectPostId: row.postId,
        action: "remove-reply",
      });
    }
    return { deleted: commentId };
  }

  /** Resolves the post through the feed's visibility rules; returns its author id. */
  private async visiblePost(postId: string, viewerId: string): Promise<string> {
    return (await this.visibleVM(postId, viewerId)).author.userId;
  }

  /** The post as the viewer may read it, a group discussion included. */
  private async visibleVM(postId: string, viewerId: string): Promise<PostVM> {
    const vm = await this.posts.byId(postId, viewerId, { groups: true });
    if (!vm) throw new NotFoundException("Post not found");
    return vm;
  }

  /**
   * Readable, and the viewer may join in: anyone on a feed post they can see,
   * only members on a group discussion (an open group can be read by anyone).
   */
  private async takingPart(postId: string, userId: string): Promise<PostVM> {
    const vm = await this.visibleVM(postId, userId);
    if (vm.group) {
      const membership = await membershipOf(this.db, vm.group.id, userId);
      if (!groupAccess("open", membership).canPost) throw new ForbiddenException(JOIN_TO_TAKE_PART);
    }
    return vm;
  }

  private async moderates(groupId: string, userId: string): Promise<boolean> {
    return groupAccess("open", await membershipOf(this.db, groupId, userId)).canModerate;
  }

  /**
   * Same check, but answers with the post the content belongs to — saving
   * somebody's repost saves the post itself, so it is still there once the
   * repost is undone.
   */
  private async contentPost(postId: string, viewerId: string): Promise<string> {
    const vm = await this.posts.byId(postId, viewerId);
    if (!vm) throw new NotFoundException("Post not found");
    return vm.postId;
  }

  private async likeState(postId: string, userId: string): Promise<LikeVM> {
    const [totalRow] = await this.db
      .select({ total: count() })
      .from(postLike)
      .where(eq(postLike.postId, postId));
    const [mine] = await this.db
      .select({ postId: postLike.postId })
      .from(postLike)
      .where(and(eq(postLike.postId, postId), eq(postLike.userId, userId)));
    return { postId, likes: Number(totalRow?.total ?? 0), likedByMe: Boolean(mine) };
  }
}
