import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, count, desc, eq, isNull, lt } from "drizzle-orm";
import { z } from "zod";
import { Db, DRIZZLE } from "../db/db.module";
import { post, postComment, postLike, profile, user, COMMENT_BODY_MAX } from "../db/schema";
import { StorageService } from "../storage/storage.service";
import {
  clamp,
  parseCursor,
  COMMENT_MAX_PAGE_SIZE,
  COMMENT_PAGE_SIZE,
  PostsService,
} from "./posts.service";

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
  };
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
  ) {}

  /** Idempotent: the composite primary key is what makes a double tap harmless. */
  async like(postId: string, userId: string): Promise<LikeVM> {
    await this.visiblePost(postId, userId);
    await this.db.insert(postLike).values({ postId, userId }).onConflictDoNothing();
    return this.likeState(postId, userId);
  }

  async unlike(postId: string, userId: string): Promise<LikeVM> {
    await this.visiblePost(postId, userId);
    await this.db
      .delete(postLike)
      .where(and(eq(postLike.postId, postId), eq(postLike.userId, userId)));
    return this.likeState(postId, userId);
  }

  /** Newest first, so a fresh comment is the first thing under a fresh post. */
  async comments(postId: string, viewerId: string, cursorArg?: string | null, limitArg?: number) {
    const authorId = await this.visiblePost(postId, viewerId);
    const limit = clamp(limitArg ?? COMMENT_PAGE_SIZE, 1, COMMENT_MAX_PAGE_SIZE);
    const cursor = parseCursor(cursorArg);
    const rows = await this.db
      .select({
        id: postComment.id,
        body: postComment.body,
        createdAt: postComment.createdAt,
        authorId: postComment.authorId,
        username: user.username,
        displayName: profile.displayName,
        avatarKey: profile.avatarKey,
      })
      .from(postComment)
      .innerJoin(user, eq(user.id, postComment.authorId))
      .leftJoin(profile, eq(profile.userId, postComment.authorId))
      .where(
        and(
          eq(postComment.postId, postId),
          isNull(postComment.deletedAt),
          ...(cursor ? [lt(postComment.createdAt, cursor)] : []),
        ),
      )
      .orderBy(desc(postComment.createdAt))
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    const [totalRow] = await this.db
      .select({ total: count() })
      .from(postComment)
      .where(and(eq(postComment.postId, postId), isNull(postComment.deletedAt)));
    const items = await Promise.all(
      page.map(async (r) => ({
        id: r.id,
        body: r.body,
        createdAt: r.createdAt.toISOString(),
        author: {
          userId: r.authorId,
          username: r.username,
          displayName: r.displayName ?? r.username ?? "Member",
          avatarUrl: r.avatarKey ? await this.storage.presignDownload(r.avatarKey, "sm") : null,
        },
        canDelete: r.authorId === viewerId || authorId === viewerId,
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
    await this.visiblePost(postId, userId);
    const [row] = await this.db
      .insert(postComment)
      .values({ postId, authorId: userId, body })
      .returning();
    const [me] = await this.db
      .select({
        username: user.username,
        displayName: profile.displayName,
        avatarKey: profile.avatarKey,
      })
      .from(user)
      .leftJoin(profile, eq(profile.userId, user.id))
      .where(eq(user.id, userId));
    return {
      id: row.id,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      author: {
        userId: userId,
        username: me?.username ?? null,
        displayName: me?.displayName ?? me?.username ?? "Member",
        avatarUrl: me?.avatarKey ? await this.storage.presignDownload(me.avatarKey, "sm") : null,
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
        postAuthorId: post.authorId,
        deletedAt: postComment.deletedAt,
      })
      .from(postComment)
      .innerJoin(post, eq(post.id, postComment.postId))
      .where(eq(postComment.id, commentId));
    if (!row || row.deletedAt) throw new NotFoundException("Comment not found");
    if (row.commentAuthorId !== userId && row.postAuthorId !== userId) {
      throw new ForbiddenException("That isn't your comment");
    }
    await this.db
      .update(postComment)
      .set({ deletedAt: new Date() })
      .where(eq(postComment.id, commentId));
    return { deleted: commentId };
  }

  /** Resolves the post through the feed's visibility rules; returns its author id. */
  private async visiblePost(postId: string, viewerId: string): Promise<string> {
    const vm = await this.posts.byId(postId, viewerId);
    if (!vm) throw new NotFoundException("Post not found");
    return vm.author.userId;
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
