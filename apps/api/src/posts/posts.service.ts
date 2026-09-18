import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, count, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Db, DRIZZLE } from "../db/db.module";
import {
  follow,
  post,
  postComment,
  postLike,
  postMedia,
  profile,
  user,
  POST_BODY_MAX,
  POST_MEDIA_MAX,
  type PostMediaKind,
  type PostVisibility,
} from "../db/schema";
import {
  IMAGE_VARIANTS,
  StorageService,
  variantKey,
  type ImageVariant,
} from "../storage/storage.service";

/** Photos only for now; the column takes video so the grid can grow into it. */
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** A post photo is the widest image the app renders, so it gets the cover budget. */
export const POST_MEDIA_MAX_MB = 10;
const maxBytes = POST_MEDIA_MAX_MB * 1024 * 1024;

export const FEED_PAGE_SIZE = 10;
export const FEED_MAX_PAGE_SIZE = 30;
export const COMMENT_PAGE_SIZE = 10;
export const COMMENT_MAX_PAGE_SIZE = 50;

/** `posts/<userId>/<uuid>.jpg` — the prefix is what proves a key belongs to its uploader. */
export const POST_MEDIA_PREFIX = "posts";

export const createPostSchema = z
  .object({
    body: z.string().trim().max(POST_BODY_MAX).optional(),
    visibility: z.enum(["public", "friends"]).default("public"),
    media: z
      .array(
        z.object({
          key: z.string().trim().min(1).max(500),
          kind: z.enum(["image", "video"]).default("image"),
        }),
      )
      .max(POST_MEDIA_MAX)
      .default([]),
  })
  .refine((v) => Boolean(v.body?.length) || v.media.length > 0, {
    message: "Write something or add a photo.",
    path: ["body"],
  });

export type CreatePostInput = z.infer<typeof createPostSchema>;

export const uploadUrlSchema = z.object({
  contentType: z.string(),
  contentLength: z.number().int().positive().optional(),
});

export interface FeedParams {
  /** ISO timestamp of the oldest post already shown; omit for the first page. */
  cursor?: string | null;
  limit?: number;
  /** Narrows the feed to one member's posts — this is the profile Posts tab. */
  author?: string | null;
}

export interface PostMediaVM {
  id: string;
  kind: PostMediaKind;
  /** Grid-sized copy: enough for a tile, a fraction of the bytes. */
  thumbUrl: string | null;
  /** Full-width / lightbox copy. */
  url: string | null;
}

export interface PostVM {
  id: string;
  body: string | null;
  visibility: PostVisibility;
  createdAt: string;
  author: {
    userId: string;
    username: string | null;
    displayName: string;
    avatarUrl: string | null;
  };
  media: PostMediaVM[];
  likes: number;
  comments: number;
  likedByMe: boolean;
  /** Whether the viewer may delete it — their own post, nothing else. */
  mine: boolean;
}

export interface FeedVM {
  items: PostVM[];
  /** Pass back as `cursor` for the next page; null when the feed is exhausted. */
  nextCursor: string | null;
}

/**
 * Posts: the home feed, composing, and reading one post.
 *
 * The feed pages by timestamp cursor rather than page number. A feed grows at
 * the top while it is being read, and an offset would hand the reader rows they
 * have already seen (or skip rows entirely) every time someone posts mid-scroll.
 *
 * Likes and comments live in `PostInteractionsService` — this class is about the
 * posts themselves.
 */
@Injectable()
export class PostsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly storage: StorageService,
  ) {}

  /**
   * Presigned slot for one post photo, plus a slot per stored size. Mirrors the
   * profile upload: the browser downsizes, uploads every size, and only then
   * names the key in `create`.
   */
  async presignMediaUpload(userId: string, contentType: string, contentLength?: number) {
    const ext = IMAGE_TYPES[contentType];
    if (!ext) {
      throw new BadRequestException(
        `contentType must be one of: ${Object.keys(IMAGE_TYPES).join(", ")}`,
      );
    }
    if (contentLength !== undefined && contentLength > maxBytes) {
      throw new BadRequestException(tooLarge());
    }
    const key = `${POST_MEDIA_PREFIX}/${userId}/${randomUUID()}.${ext}`;
    const [uploadUrl, ...variantUrls] = await Promise.all([
      this.storage.presignUpload(key, contentType, contentLength),
      ...IMAGE_VARIANTS.map((v) => this.storage.presignUpload(variantKey(key, v), contentType)),
    ]);
    const variantUploadUrls = Object.fromEntries(
      IMAGE_VARIANTS.map((v, i) => [v, variantUrls[i]]),
    ) as Record<ImageVariant, string>;
    return {
      key,
      uploadUrl,
      variantUploadUrls,
      expiresInSeconds: 600,
      maxSizeMb: POST_MEDIA_MAX_MB,
      maxFiles: POST_MEDIA_MAX,
    };
  }

  async create(userId: string, input: CreatePostInput): Promise<PostVM> {
    await this.verifyMedia(userId, input.media);
    const [row] = await this.db
      .insert(post)
      .values({
        authorId: userId,
        body: input.body?.length ? input.body : null,
        visibility: input.visibility,
      })
      .returning();
    if (input.media.length) {
      await this.db.insert(postMedia).values(
        input.media.map((m, i) => ({
          postId: row.id,
          kind: m.kind,
          key: m.key,
          position: i,
        })),
      );
    }
    const vm = await this.byId(row.id, userId);
    if (!vm) throw new NotFoundException("Post not found");
    return vm;
  }

  /** The home feed, or one member's posts when `authorId` is given. */
  async feed(viewerId: string, params: FeedParams = {}): Promise<FeedVM> {
    const limit = clamp(params.limit ?? FEED_PAGE_SIZE, 1, FEED_MAX_PAGE_SIZE);
    const cursor = parseCursor(params.cursor);
    const authorId = params.author ? await this.resolveAuthor(params.author) : null;
    const rows = await this.selectPosts(
      viewerId,
      [
        ...(cursor ? [lt(post.createdAt, cursor)] : []),
        ...(authorId ? [eq(post.authorId, authorId)] : []),
      ],
      limit + 1,
    );
    const page = rows.slice(0, limit);
    const items = await this.decorate(page, viewerId);
    return {
      items,
      nextCursor: rows.length > limit ? (page.at(-1)?.createdAt.toISOString() ?? null) : null,
    };
  }

  /** One post, or null when it is missing, deleted or not visible to the viewer. */
  async byId(postId: string, viewerId: string): Promise<PostVM | null> {
    const rows = await this.selectPosts(viewerId, [eq(post.id, postId)], 1);
    if (!rows.length) return null;
    const [vm] = await this.decorate(rows, viewerId);
    return vm ?? null;
  }

  /**
   * Soft delete: the row stays so a like or comment landing at the same moment
   * has something to point at, while every read filters it out. The photos are
   * removed from the bucket right away — they are the part that costs money.
   */
  async remove(postId: string, userId: string) {
    const [row] = await this.db
      .select({ authorId: post.authorId, deletedAt: post.deletedAt })
      .from(post)
      .where(eq(post.id, postId));
    if (!row || row.deletedAt) throw new NotFoundException("Post not found");
    if (row.authorId !== userId) throw new ForbiddenException("That isn't your post");
    await this.db.update(post).set({ deletedAt: new Date() }).where(eq(post.id, postId));
    const media = await this.db
      .select({ key: postMedia.key })
      .from(postMedia)
      .where(eq(postMedia.postId, postId));
    await Promise.all(
      media.flatMap((m) => [
        this.storage.remove(m.key),
        ...IMAGE_VARIANTS.map((v) => this.storage.remove(variantKey(m.key, v))),
      ]),
    );
    return { deleted: postId };
  }

  /**
   * How many posts each of these members has that this viewer may see. The
   * member cards and the profile header both show the number, and it has to
   * agree with what the Posts tab will actually list — so it is counted through
   * the same visibility rule the feed uses rather than a second copy of it.
   */
  async postCountsFor(authorIds: string[], viewerId: string): Promise<Map<string, number>> {
    if (!authorIds.length) return new Map();
    const viewerFollows = alias(follow, "viewer_follows_author");
    const authorFollows = alias(follow, "author_follows_viewer");
    const rows = await this.db
      .select({ authorId: post.authorId, n: count() })
      .from(post)
      .leftJoin(
        viewerFollows,
        and(eq(viewerFollows.followerId, viewerId), eq(viewerFollows.followingId, post.authorId)),
      )
      .leftJoin(
        authorFollows,
        and(eq(authorFollows.followerId, post.authorId), eq(authorFollows.followingId, viewerId)),
      )
      .where(
        and(
          isNull(post.deletedAt),
          inArray(post.authorId, authorIds),
          visibleTo(viewerId, viewerFollows, authorFollows),
        ),
      )
      .groupBy(post.authorId);
    return new Map(rows.map((r) => [r.authorId, Number(r.n)]));
  }

  /**
   * Photos and videos this viewer may see from one member's posts, newest first.
   * The profile Media tab shows them beside the avatars and covers, so a photo
   * a member posted is findable from their profile and not only from the feed.
   */
  async postMediaFor(
    authorId: string,
    viewerId: string,
    kinds: PostMediaKind[],
    limit: number,
    offset: number,
  ) {
    if (!kinds.length) return { rows: [], total: 0 };
    const viewerFollows = alias(follow, "viewer_follows_author");
    const authorFollows = alias(follow, "author_follows_viewer");
    const where = and(
      isNull(post.deletedAt),
      eq(post.authorId, authorId),
      inArray(postMedia.kind, kinds),
      visibleTo(viewerId, viewerFollows, authorFollows),
    );
    const base = () =>
      this.db
        .select({
          id: postMedia.id,
          kind: postMedia.kind,
          key: postMedia.key,
          createdAt: postMedia.createdAt,
        })
        .from(postMedia)
        .innerJoin(post, eq(post.id, postMedia.postId))
        .leftJoin(
          viewerFollows,
          and(eq(viewerFollows.followerId, viewerId), eq(viewerFollows.followingId, post.authorId)),
        )
        .leftJoin(
          authorFollows,
          and(eq(authorFollows.followerId, post.authorId), eq(authorFollows.followingId, viewerId)),
        )
        .where(where);
    const [rows, totalRows] = await Promise.all([
      base().orderBy(desc(postMedia.createdAt)).limit(limit).offset(offset),
      base(),
    ]);
    return { rows, total: totalRows.length };
  }

  /** Usernames are stored lowercase by the username plugin; accept "@Handle" too. */
  private async resolveAuthor(username: string): Promise<string> {
    const handle = username.replace(/^@/, "").toLowerCase();
    const [row] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.username, handle))
      .limit(1);
    if (!row) throw new NotFoundException("Member not found.");
    return row.id;
  }

  /**
   * Rows the viewer is allowed to see: anything public, everything of their own,
   * and friends-only posts from members they and the author both follow.
   */
  private async selectPosts(viewerId: string, extra: ReturnType<typeof eq>[], limit: number) {
    const viewerFollows = alias(follow, "viewer_follows_author");
    const authorFollows = alias(follow, "author_follows_viewer");
    return this.db
      .select({
        id: post.id,
        body: post.body,
        visibility: post.visibility,
        createdAt: post.createdAt,
        authorId: post.authorId,
        username: user.username,
        displayName: profile.displayName,
        avatarKey: profile.avatarKey,
      })
      .from(post)
      .innerJoin(user, eq(user.id, post.authorId))
      .leftJoin(profile, eq(profile.userId, post.authorId))
      .leftJoin(
        viewerFollows,
        and(eq(viewerFollows.followerId, viewerId), eq(viewerFollows.followingId, post.authorId)),
      )
      .leftJoin(
        authorFollows,
        and(eq(authorFollows.followerId, post.authorId), eq(authorFollows.followingId, viewerId)),
      )
      .where(
        and(isNull(post.deletedAt), visibleTo(viewerId, viewerFollows, authorFollows), ...extra),
      )
      .orderBy(desc(post.createdAt))
      .limit(limit);
  }

  /** Attaches media, counts and the viewer's own like to a page of rows. */
  private async decorate(
    rows: Awaited<ReturnType<PostsService["selectPosts"]>>,
    viewerId: string,
  ): Promise<PostVM[]> {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const [media, likes, comments, mine] = await Promise.all([
      this.db
        .select()
        .from(postMedia)
        .where(inArray(postMedia.postId, ids))
        .orderBy(postMedia.position),
      this.db
        .select({ postId: postLike.postId, n: count() })
        .from(postLike)
        .where(inArray(postLike.postId, ids))
        .groupBy(postLike.postId),
      this.db
        .select({ postId: postComment.postId, n: count() })
        .from(postComment)
        .where(and(inArray(postComment.postId, ids), isNull(postComment.deletedAt)))
        .groupBy(postComment.postId),
      this.db
        .select({ postId: postLike.postId })
        .from(postLike)
        .where(and(inArray(postLike.postId, ids), eq(postLike.userId, viewerId))),
    ]);
    const likeCount = new Map(likes.map((r) => [r.postId, Number(r.n)]));
    const commentCount = new Map(comments.map((r) => [r.postId, Number(r.n)]));
    const likedByMe = new Set(mine.map((r) => r.postId));
    const mediaByPost = new Map<string, PostMediaVM[]>();
    await Promise.all(
      media.map(async (m) => {
        const vm: PostMediaVM = {
          id: m.id,
          kind: m.kind,
          thumbUrl: await this.storage.presignDownload(m.key, "md"),
          url: await this.storage.presignDownload(m.key),
        };
        mediaByPost.set(m.postId, [...(mediaByPost.get(m.postId) ?? []), vm]);
      }),
    );
    return Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        body: r.body,
        visibility: r.visibility,
        createdAt: r.createdAt.toISOString(),
        author: {
          userId: r.authorId,
          username: r.username,
          displayName: r.displayName ?? r.username ?? "Member",
          // Post headers are 36px circles — the small size is a few KB.
          avatarUrl: r.avatarKey ? await this.storage.presignDownload(r.avatarKey, "sm") : null,
        },
        media: mediaByPost.get(r.id) ?? [],
        likes: likeCount.get(r.id) ?? 0,
        comments: commentCount.get(r.id) ?? 0,
        likedByMe: likedByMe.has(r.id),
        mine: r.authorId === viewerId,
      })),
    );
  }

  /**
   * A key only becomes post media once S3 confirms the object exists, sits under
   * this member's own prefix, and is an allowed image within the size cap. The
   * prefix check is the important one: without it a member could attach a key
   * they had seen belonging to somebody else.
   */
  private async verifyMedia(userId: string, media: CreatePostInput["media"]) {
    const prefix = `${POST_MEDIA_PREFIX}/${userId}/`;
    for (const m of media) {
      if (!m.key.startsWith(prefix)) throw new BadRequestException("media: unknown upload");
      const info = await this.storage.describe(m.key);
      if (!info) throw new BadRequestException("media: upload not found");
      if (info.size > maxBytes) {
        await this.storage.remove(m.key);
        throw new BadRequestException(tooLarge());
      }
      if (!info.contentType || !IMAGE_TYPES[info.contentType]) {
        await this.storage.remove(m.key);
        throw new BadRequestException(
          `contentType must be one of: ${Object.keys(IMAGE_TYPES).join(", ")}`,
        );
      }
      // An older client may upload only the original; fill the missing sizes by
      // copy so the grid asks for an object that exists.
      await Promise.all(
        IMAGE_VARIANTS.map(async (v) => {
          const target = variantKey(m.key, v);
          if (!(await this.storage.describe(target))) await this.storage.copy(m.key, target);
        }),
      );
    }
  }
}

const tooLarge = () => `Photo is too large — max ${POST_MEDIA_MAX_MB}MB.`;

/**
 * The one visibility rule: anything public, everything of the viewer's own, and
 * friends-only posts between two members who follow each other. The feed, the
 * post counts and the profile Media tab all go through this, because three
 * copies of it would eventually disagree and leak somebody's friends-only post.
 */
function visibleTo(
  viewerId: string,
  viewerFollows: ReturnType<typeof alias<typeof follow, string>>,
  authorFollows: ReturnType<typeof alias<typeof follow, string>>,
) {
  return or(
    eq(post.visibility, "public"),
    eq(post.authorId, viewerId),
    and(
      eq(post.visibility, "friends"),
      sql`${viewerFollows.followerId} is not null`,
      sql`${authorFollows.followerId} is not null`,
    ),
  );
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.floor(n)));
}

/** An unparseable cursor is treated as "start from the top" rather than an error. */
export function parseCursor(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
