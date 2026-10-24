import { notBanned } from "../moderation/admins";
import { privacyAllows, privateProfileValue } from "../privacy/privacy-policy";
import { teamBadge } from "../members/team-badge";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  and,
  count,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNull,
  lt,
  ne,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { noBlockEitherWay } from "../safety/blocks";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Db, DRIZZLE } from "../db/db.module";
import { containsPattern } from "../push/notifications.service";
import { PushService } from "../push/push.service";
import {
  follow,
  memberSubscription,
  post,
  postComment,
  postLike,
  postShare,
  postMedia,
  postSave,
  postTag,
  profile,
  user,
  walletGift,
  POST_BODY_MAX,
  POST_MEDIA_MAX,
  type PostMediaKind,
  type PostVisibility,
} from "../db/schema";
import {
  knownHandles,
  membersToTell,
  mentionCandidates,
  mentionsIn,
  type Mention,
} from "./mentions";
import {
  MAX_TAGS,
  tags,
  taggableIds,
  tagSuggestions,
  tagsOn,
  type TaggedMemberVM,
} from "./post-tags";
import {
  IMAGE_VARIANTS,
  StorageService,
  variantKey,
  type ImageVariant,
} from "../storage/storage.service";
import { hasSilver, SILVER_POST_BODY_MAX, silverCheck } from "../subscriptions/plans";
import type { FeedHint, FeedTab, RankedTab } from "./feed-ranking";
import { followingConditions, followsAnyone, rankedTabPage } from "./feed-tabs";
import { visibleTo } from "./visibility";

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
/** How long an organization's post opens For You in its country, and how many at once. */
export const ORGANIZATION_PIN_HOURS = 48;
export const ORGANIZATION_PINS = 3;
// Aliased so the organization check can sit beside the author's own joined profile.
const ORG = "org_profile";
const orgProfile = alias(profile, ORG);
export const FEED_MAX_PAGE_SIZE = 30;
export const COMMENT_PAGE_SIZE = 10;
export const COMMENT_MAX_PAGE_SIZE = 50;

/** Said when a Basic member's post is longer than POST_BODY_MAX. */
export const LONG_POST_NEEDS_SILVER = `Posts can be up to ${POST_BODY_MAX.toLocaleString(
  "en-US",
)} characters. Silver members can write up to ${SILVER_POST_BODY_MAX.toLocaleString("en-US")}.`;

/** `posts/<userId>/<uuid>.jpg` — the prefix is what proves a key belongs to its uploader. */
export const POST_MEDIA_PREFIX = "posts";

export const createPostSchema = z
  .object({
    // Silver's limit; everyone else's is checked in create(), where the plan is known.
    body: z.string().trim().max(SILVER_POST_BODY_MAX).optional(),
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
    /** Usernames of the friends the author tags. */
    tags: z
      .array(
        z
          .string()
          .trim()
          .regex(/^@?[a-z0-9_]{3,30}$/i, "Tag members by their username."),
      )
      .max(MAX_TAGS)
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
  /**
   * Where the last page ended; omit for the first page. The ISO timestamp of
   * the oldest post shown, except on For You and Nearby, whose cursor is
   * opaque (feed-ranking.ts).
   */
  cursor?: string | null;
  limit?: number;
  /** Narrows the feed to one member's posts — this is the profile Posts tab. */
  author?: string | null;
  /** Narrows the feed to the posts that tag one member — the profile Tagged tab. */
  tagged?: string | null;
  /** Search: only posts whose text contains this. Reposts carry no text, so originals only. */
  q?: string | null;
  /**
   * The home feed's tab. Without one, the feed is every visible post, newest
   * first, as before the tabs; `author` and `q` read that way whatever the tab.
   */
  tab?: FeedTab | null;
}

export interface PostMediaVM {
  id: string;
  kind: PostMediaKind;
  /** Grid-sized copy: enough for a tile, a fraction of the bytes. */
  thumbUrl: string | null;
  /** Full-width / lightbox copy. */
  url: string | null;
}

export interface PostAuthorVM {
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  /** Shows the Silver check beside their name. */
  silver: boolean;
  teamMember?: boolean;
  subscribed: boolean;
  /** Whether the viewer follows them, so a post can offer Follow without a profile request. */
  isFollowing: boolean;
}

export interface PostVM {
  /** The row in the feed — a repost has its own id, and that is what a delete removes. */
  id: string;
  /**
   * The post the content belongs to: the original when this row is a repost,
   * otherwise the same as `id`. Likes, comments, saves and shares all target
   * this, so reacting to a repost reacts to the post it points at.
   */
  postId: string;
  body: string | null;
  visibility: PostVisibility;
  createdAt: string;
  author: PostAuthorVM;
  media: PostMediaVM[];
  likes: number;
  shares: number;
  gifts: number;
  comments: number;
  reposts: number;
  likedByMe: boolean;
  repostedByMe: boolean;
  savedByMe: boolean;
  /** Who put this in the feed, when the row is their repost of someone's post. */
  repostedBy: Pick<PostAuthorVM, "userId" | "username" | "displayName"> | null;
  /** Whether the viewer may delete this row — their own post or their own repost. */
  mine: boolean;
  /** Each @handle in the body that names a member, and whom: the ones the app links. */
  mentions: Mention[];
  /** The author's friends tagged in the post, as the viewer may see them. */
  tagged: TaggedMemberVM[];
  /** The viewer is one of them, so the post offers to take their tag off. */
  taggedMe: boolean;
}

export interface RepostVM {
  postId: string;
  reposts: number;
  repostedByMe: boolean;
}

export interface SaveVM {
  postId: string;
  savedByMe: boolean;
}

export interface FeedVM {
  items: PostVM[];
  /** Pass back as `cursor` for the next page; null when the feed is exhausted. */
  nextCursor: string | null;
  /**
   * Why a tab may be empty, so the app can say what would fill it: the viewer
   * follows nobody (Following), or has no state (Nearby).
   */
  hint?: FeedHint;
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
  private readonly log = new Logger(PostsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly storage: StorageService,
    private readonly push: PushService,
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
    if ((input.body?.length ?? 0) > POST_BODY_MAX && !(await hasSilver(this.db, userId))) {
      throw new BadRequestException(LONG_POST_NEEDS_SILVER);
    }
    await this.verifyMedia(userId, input.media);
    // Checked before anything is written, so a refused tag never leaves a post behind.
    const tagged = await taggableIds(this.db, userId, input.tags ?? []);
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
    if (tagged.length) {
      await this.db
        .insert(postTag)
        .values(tagged.map((taggedId) => ({ postId: row.id, userId: taggedId })));
      for (const taggedId of tagged) this.push.tagged(row.id, taggedId, userId);
    }
    // A tagged member hears of the tag; a mention of them too would tell them twice.
    this.notifyMentions(row.id, userId, input.body, tagged);
    const vm = await this.byId(row.id, userId);
    if (!vm) throw new NotFoundException("Post not found");
    return vm;
  }

  /** Whether the viewer can read this post, by the feed's own rules. */
  async canSee(postId: string, viewerId: string): Promise<boolean> {
    return (await this.selectPosts(viewerId, [eq(post.id, postId)], 1)).length > 0;
  }

  /**
   * Tells the members a post or a comment on it mentions, once each and ten at
   * most: members who exist, can see the post (a friends-only post's link would
   * only say "not found"), and aren't the writer or `except` (a post's author
   * already hears of a comment). A block is honoured where the inbox records it.
   * Never fails the post or comment.
   */
  notifyMentions(
    postId: string,
    actorId: string,
    text: string | null | undefined,
    except: string[] = [],
  ): void {
    const names = mentionCandidates(text);
    if (!names.length) return;
    void (async () => {
      const members = await knownHandles(this.db, names, actorId);
      for (const name of membersToTell(mentionsIn(text, members))) {
        const id = members.get(name) as string;
        if (id === actorId || except.includes(id)) continue;
        if (await this.canSee(postId, id)) this.push.newMention(postId, id, actorId);
      }
    })().catch((e: unknown) => this.log.warn(`mention notifications failed: ${String(e)}`));
  }

  /**
   * The home feed — For You, Following or Nearby when a tab is given — or one
   * member's posts when `author` is, or a search when `q` is.
   */
  async feed(viewerId: string, params: FeedParams = {}): Promise<FeedVM> {
    const limit = clamp(params.limit ?? FEED_PAGE_SIZE, 1, FEED_MAX_PAGE_SIZE);
    const tab = params.author || params.q || params.tagged ? null : (params.tab ?? null);
    if (tab === "for_you" || tab === "nearby") return this.rankedFeed(viewerId, tab, params, limit);
    const following = tab === "following";
    const cursor = parseCursor(params.cursor);
    const authorId = params.author ? await this.resolveAuthor(params.author) : null;
    const taggedId = params.tagged ? await this.resolveAuthor(params.tagged) : null;
    const rows = await this.selectPosts(
      viewerId,
      [
        ...(cursor ? [lt(post.createdAt, cursor)] : []),
        ...(authorId ? [eq(post.authorId, authorId)] : []),
        ...(taggedId ? [tags(post.id, taggedId)] : []),
        ...(params.q ? [ilike(post.body, containsPattern(params.q))] : []),
        ...(following ? followingConditions(viewerId) : []),
      ],
      limit + 1,
    );
    const page = rows.slice(0, limit);
    const items = await this.decorate(page, viewerId);
    const nextCursor = rows.length > limit ? (page.at(-1)?.createdAt.toISOString() ?? null) : null;
    // An empty Following says how to fill it when the viewer follows nobody yet.
    if (following && !cursor && !rows.length && !(await followsAnyone(this.db, viewerId))) {
      return { items, nextCursor, hint: "no_follows" };
    }
    return { items, nextCursor };
  }

  /**
   * For You and Nearby: feed-tabs.ts decides which rows and in what order; they
   * are read here through the same visibility rule and decorated like any page.
   */
  private async rankedFeed(
    viewerId: string,
    tab: RankedTab,
    params: FeedParams,
    limit: number,
  ): Promise<FeedVM> {
    const page = await rankedTabPage(this.db, viewerId, tab, params.cursor, limit);
    const rows = page.ids.length
      ? await this.selectPosts(viewerId, [inArray(post.id, page.ids)], page.ids.length)
      : [];
    const byId = new Map(rows.map((r) => [r.id, r]));
    // The viewer's country's organizations' newest posts open For You.
    const pinned = tab === "for_you" && !params.cursor ? await this.organizationPins(viewerId) : [];
    const pinnedIds = new Set(pinned.map((r) => r.id));
    const ordered = [
      ...pinned,
      ...page.ids.flatMap((id) => byId.get(id) ?? []).filter((r) => !pinnedIds.has(r.id)),
    ];
    return {
      items: await this.decorate(ordered, viewerId),
      nextCursor: page.nextCursor,
      ...(page.hint ? { hint: page.hint } : {}),
    };
  }

  /**
   * Organizations' posts are a must on For You (founder, 2026-10-21): for 48
   * hours after posting, an organization's public post opens the first page
   * for every member in its country, newest first and a few at most, so a busy
   * organization can't bury the feed. An organization with no country speaks
   * to every country, as Kinkord's own does (founder, 2026-10-22): its posts
   * come first, for everyone, then the viewer's own country's. Members who
   * blocked an organization, or whom it blocked, never see its posts.
   */
  private async organizationPins(viewerId: string) {
    const pins = (whose: SQL, limit: number) =>
      this.selectPosts(
        viewerId,
        [
          gt(post.createdAt, sql`now() - (${ORGANIZATION_PIN_HOURS} * interval '1 hour')`),
          isNull(post.repostOfId),
          eq(post.visibility, "public"),
          ne(post.authorId, viewerId),
          noBlockEitherWay(post.authorId, viewerId),
          sql`exists (select 1 from ${profile} ${sql.identifier(ORG)} where ${orgProfile.userId} = ${post.authorId} and ${orgProfile.accountType} = 'organization' and ${whose})`,
        ],
        limit,
      );
    const everywhere = await pins(sql`${orgProfile.country} is null`, ORGANIZATION_PINS);
    const room = ORGANIZATION_PINS - everywhere.length;
    if (room <= 0) return everywhere;
    const [viewer] = await this.db
      .select({ country: profile.country })
      .from(profile)
      .where(eq(profile.userId, viewerId))
      .limit(1);
    if (!viewer?.country) return everywhere;
    return [...everywhere, ...(await pins(sql`${orgProfile.country} = ${viewer.country}`, room))];
  }

  /** One post, or null when it is missing, deleted or not visible to the viewer. */
  async byId(postId: string, viewerId: string): Promise<PostVM | null> {
    const rows = await this.selectPosts(
      viewerId,
      [eq(post.id, postId), privacyAllows(viewerId, post.authorId, "sharedContent")],
      1,
    );
    if (!rows.length) return null;
    const [vm] = await this.decorate(rows, viewerId);
    return vm ?? null;
  }

  /**
   * Repost: a post row of the viewer's own pointing at somebody's post.
   *
   * Only a public post can be reposted. A friends-only post is shared with a
   * chosen circle, and letting it be lifted into a stranger's feed would undo
   * exactly the choice its author made.
   *
   * Reposting a repost points at the original, so a chain never forms.
   */
  async repost(postId: string, userId: string): Promise<RepostVM> {
    const vm = await this.repostTargetVM(postId, userId);
    const target = vm.postId;
    const added = await this.db
      .insert(post)
      .values({ authorId: userId, repostOfId: target, visibility: "public" })
      // The partial unique index is the rule; a double tap is simply a no-op.
      .onConflictDoNothing()
      .returning({ id: post.id });
    if (added.length) this.push.newRepost(target, vm.author.userId, userId);
    return this.repostState(target, userId);
  }

  async unrepost(postId: string, userId: string): Promise<RepostVM> {
    const target = await this.repostTarget(postId, userId);
    await this.db
      .update(post)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(post.repostOfId, target),
          eq(post.authorId, userId),
          and(isNull(post.deletedAt), isNull(post.archivedAt)),
        ),
      );
    return this.repostState(target, userId);
  }

  /** The viewer's saved posts, newest save first. Private to them. */
  async savedFeed(viewerId: string, params: { cursor?: string | null; limit?: number } = {}) {
    const limit = clamp(params.limit ?? FEED_PAGE_SIZE, 1, FEED_MAX_PAGE_SIZE);
    const cursor = parseCursor(params.cursor);
    const saves = await this.db
      .select({ postId: postSave.postId, createdAt: postSave.createdAt })
      .from(postSave)
      .where(
        and(eq(postSave.userId, viewerId), ...(cursor ? [lt(postSave.createdAt, cursor)] : [])),
      )
      .orderBy(desc(postSave.createdAt))
      .limit(limit + 1);
    const page = saves.slice(0, limit);
    if (!page.length) return { items: [], nextCursor: null } satisfies FeedVM;
    // Re-read through the feed's own rules: a post saved while it was visible
    // must stop appearing here if it is deleted or the friendship ends.
    const rows = await this.selectPosts(
      viewerId,
      [
        inArray(
          post.id,
          page.map((s) => s.postId),
        ),
      ],
      page.length,
    );
    const byId = new Map(rows.map((r) => [r.id, r]));
    const ordered = page
      .map((s) => byId.get(s.postId))
      .filter((r): r is (typeof rows)[number] => Boolean(r));
    return {
      items: await this.decorate(ordered, viewerId),
      nextCursor: saves.length > limit ? (page.at(-1)?.createdAt.toISOString() ?? null) : null,
    } satisfies FeedVM;
  }

  /** Resolves what a repost should point at, and refuses what may not be lifted. */
  private async repostTarget(postId: string, viewerId: string): Promise<string> {
    return (await this.repostTargetVM(postId, viewerId)).postId;
  }

  private async repostTargetVM(postId: string, viewerId: string): Promise<PostVM> {
    const vm = await this.byId(postId, viewerId);
    if (!vm) throw new NotFoundException("Post not found");
    if (vm.visibility !== "public") {
      throw new ForbiddenException("Friends-only posts cannot be reposted");
    }
    // Reposting somebody's repost points at the post itself.
    return vm;
  }

  private async repostState(postId: string, userId: string): Promise<RepostVM> {
    const [total] = await this.db
      .select({ n: count() })
      .from(post)
      .where(
        and(eq(post.repostOfId, postId), and(isNull(post.deletedAt), isNull(post.archivedAt))),
      );
    const [mine] = await this.db
      .select({ id: post.id })
      .from(post)
      .where(
        and(
          eq(post.repostOfId, postId),
          eq(post.authorId, userId),
          and(isNull(post.deletedAt), isNull(post.archivedAt)),
        ),
      );
    return { postId, reposts: Number(total?.n ?? 0), repostedByMe: Boolean(mine) };
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
    await this.purge(postId);
    return { deleted: postId };
  }

  /**
   * The same removal for a moderator, who by definition isn't the author.
   * Returns the author so the moderation log can say whose post it was.
   */
  async removeAsModerator(postId: string): Promise<{ deleted: string; authorId: string }> {
    const [row] = await this.db
      .select({ authorId: post.authorId, deletedAt: post.deletedAt })
      .from(post)
      .where(eq(post.id, postId));
    if (!row || row.deletedAt) throw new NotFoundException("Post not found");
    await this.purge(postId);
    return { deleted: postId, authorId: row.authorId };
  }

  private async purge(postId: string) {
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
          and(isNull(post.deletedAt), isNull(post.archivedAt)),
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
      and(isNull(post.deletedAt), isNull(post.archivedAt)),
      eq(post.authorId, authorId),
      inArray(postMedia.kind, kinds),
      privacyAllows(viewerId, post.authorId, "media"),
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
  /**
   * Counts a completed native share or link copy, against the original visible
   * post. Each member counts once per post, however often they share it.
   */
  async share(postId: string, viewerId: string) {
    const visible = await this.byId(postId, viewerId);
    if (!visible) throw new NotFoundException("Post not found");
    return this.db.transaction(async (tx) => {
      const [first] = await tx
        .insert(postShare)
        .values({ postId: visible.postId, userId: viewerId })
        .onConflictDoNothing()
        .returning({ postId: postShare.postId });
      const live = and(
        eq(post.id, visible.postId),
        and(isNull(post.deletedAt), isNull(post.archivedAt)),
      );
      const [row] = first
        ? await tx
            .update(post)
            .set({ shares: sql`${post.shares} + 1` })
            .where(live)
            .returning({ shares: post.shares })
        : await tx.select({ shares: post.shares }).from(post).where(live);
      if (!row) throw new NotFoundException("Post not found");
      return { postId: visible.postId, shares: row.shares };
    });
  }

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
        shares: post.shares,
        visibility: post.visibility,
        createdAt: post.createdAt,
        authorId: post.authorId,
        repostOfId: post.repostOfId,
        username: user.username,
        displayName: profile.displayName,
        avatarKey: privateProfileValue(viewerId, profile.userId, "profilePhoto", profile.avatarKey),
        teamMember: teamBadge(post.authorId),
        silver: silverCheck(post.authorId),
        subscribed: sql<boolean>`exists (select 1 from ${memberSubscription} where ${memberSubscription.userId} = ${post.authorId} and ${memberSubscription.currentPeriodEnd} > now())`,
        // The visibility rule's own join, so it costs nothing extra.
        viewerFollowsAuthor: sql<boolean>`${viewerFollows.followerId} is not null`,
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
        and(
          and(isNull(post.deletedAt), isNull(post.archivedAt)),
          visibleTo(viewerId, viewerFollows, authorFollows),
          ...extra,
        ),
      )
      .orderBy(desc(post.createdAt))
      .limit(limit);
  }

  /** Attaches media, counts and the viewer's own like to a page of rows. */
  /**
   * The post a repost points at. Only public posts can be reposted, and that is
   * asserted again here: a repost must never become a way to see a friends-only
   * post, however the row got written.
   */
  private async originalsById(ids: string[], viewerId: string) {
    const viewerFollows = alias(follow, "viewer_follows_author");
    const rows = await this.db
      .select({
        id: post.id,
        body: post.body,
        shares: post.shares,
        visibility: post.visibility,
        createdAt: post.createdAt,
        authorId: post.authorId,
        repostOfId: post.repostOfId,
        username: user.username,
        displayName: profile.displayName,
        avatarKey: privateProfileValue(viewerId, profile.userId, "profilePhoto", profile.avatarKey),
        teamMember: teamBadge(post.authorId),
        silver: silverCheck(post.authorId),
        subscribed: sql<boolean>`exists (select 1 from ${memberSubscription} where ${memberSubscription.userId} = ${post.authorId} and ${memberSubscription.currentPeriodEnd} > now())`,
        // A repost's card shows the original's author, so it's their follow that counts.
        viewerFollowsAuthor: sql<boolean>`${viewerFollows.followerId} is not null`,
      })
      .from(post)
      .innerJoin(user, eq(user.id, post.authorId))
      .leftJoin(profile, eq(profile.userId, post.authorId))
      .leftJoin(
        viewerFollows,
        and(eq(viewerFollows.followerId, viewerId), eq(viewerFollows.followingId, post.authorId)),
      )
      .where(
        and(
          inArray(post.id, ids),
          and(isNull(post.deletedAt), isNull(post.archivedAt)),
          eq(post.visibility, "public"),
          privacyAllows(viewerId, post.authorId, "posts"),
          privacyAllows(viewerId, post.authorId, "sharedContent"),
          notBanned(post.authorId),
        ),
      );
    return new Map(rows.map((r) => [r.id, r]));
  }

  /** Attaches media, counts and the viewer's own reactions to a page of rows. */
  private async decorate(
    rows: Awaited<ReturnType<PostsService["selectPosts"]>>,
    viewerId: string,
  ): Promise<PostVM[]> {
    if (!rows.length) return [];

    // A repost carries no words or photos of its own; its content is the post
    // it points at, so that is what gets counted, reacted to and rendered.
    const originalIds = [...new Set(rows.map((r) => r.repostOfId).filter(isId))];
    const originals = originalIds.length
      ? await this.originalsById(originalIds, viewerId)
      : new Map();
    const pairs = rows
      .map((row) => ({
        row,
        content: row.repostOfId ? (originals.get(row.repostOfId) ?? null) : row,
      }))
      // A repost of a post that has since been deleted simply leaves the feed.
      .filter(
        (p): p is { row: (typeof rows)[number]; content: (typeof rows)[number] } =>
          p.content !== null,
      );
    if (!pairs.length) return [];

    const ids = [...new Set(pairs.map((p) => p.content.id))];
    const [media, likes, comments, reposts, liked, reposted, saved, gifts] = await Promise.all([
      this.db
        .select()
        .from(postMedia)
        // A post's photos follow the post's own audience, so it never shows up without
        // them; the Photos and Videos setting covers the profile's Media tab.
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
        .select({ postId: post.repostOfId, n: count() })
        .from(post)
        .where(
          and(inArray(post.repostOfId, ids), and(isNull(post.deletedAt), isNull(post.archivedAt))),
        )
        .groupBy(post.repostOfId),
      this.db
        .select({ postId: postLike.postId })
        .from(postLike)
        .where(and(inArray(postLike.postId, ids), eq(postLike.userId, viewerId))),
      this.db
        .select({ postId: post.repostOfId })
        .from(post)
        .where(
          and(
            inArray(post.repostOfId, ids),
            eq(post.authorId, viewerId),
            and(isNull(post.deletedAt), isNull(post.archivedAt)),
          ),
        ),
      this.db
        .select({ postId: postSave.postId })
        .from(postSave)
        .where(and(inArray(postSave.postId, ids), eq(postSave.userId, viewerId))),
      this.db
        .select({ postId: walletGift.postId, n: count() })
        .from(walletGift)
        .where(inArray(walletGift.postId, ids))
        .groupBy(walletGift.postId),
    ]);

    const giftCount = new Map(gifts.map((r) => [r.postId, Number(r.n)]));
    const likeCount = new Map(likes.map((r) => [r.postId, Number(r.n)]));
    const commentCount = new Map(comments.map((r) => [r.postId, Number(r.n)]));
    const repostCount = new Map(reposts.map((r) => [r.postId, Number(r.n)]));
    const likedByMe = new Set(liked.map((r) => r.postId));
    const repostedByMe = new Set(reposted.map((r) => r.postId).filter(isId));
    const savedByMe = new Set(saved.map((r) => r.postId));

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

    // Post headers are 36px circles — the small size is a few KB.
    const avatar = (key: string | null) =>
      key ? this.storage.presignDownload(key, "sm") : Promise.resolve(null);
    // One lookup for every @handle on the page; none when nobody is mentioned.
    const members = await knownHandles(
      this.db,
      pairs.flatMap(({ content }) => mentionCandidates(content.body)),
    );
    const tagged = await tagsOn(this.db, ids, viewerId);

    return Promise.all(
      pairs.map(async ({ row, content }) => ({
        id: row.id,
        postId: content.id,
        body: content.body,
        visibility: content.visibility,
        // The age shown is the age of the repost — that is when it reached the feed.
        createdAt: row.createdAt.toISOString(),
        author: {
          userId: content.authorId,
          username: content.username,
          displayName: content.displayName ?? content.username ?? "Member",
          avatarUrl: await avatar(content.avatarKey),
          silver: Boolean(content.silver),
          teamMember: Boolean(content.teamMember),
          subscribed: Boolean(content.subscribed),
          isFollowing: Boolean(content.viewerFollowsAuthor),
        },
        media: mediaByPost.get(content.id) ?? [],
        likes: likeCount.get(content.id) ?? 0,
        shares: content.shares ?? 0,
        gifts: giftCount.get(content.id) ?? 0,
        comments: commentCount.get(content.id) ?? 0,
        reposts: repostCount.get(content.id) ?? 0,
        likedByMe: likedByMe.has(content.id),
        repostedByMe: repostedByMe.has(content.id),
        savedByMe: savedByMe.has(content.id),
        repostedBy:
          row.id === content.id
            ? null
            : {
                userId: row.authorId,
                username: row.username,
                displayName: row.displayName ?? row.username ?? "Member",
              },
        mine: row.authorId === viewerId,
        mentions: mentionsIn(content.body, members),
        tagged: tagged.get(content.id) ?? [],
        taggedMe: (tagged.get(content.id) ?? []).some((t) => t.userId === viewerId),
      })),
    );
  }

  /**
   * The tagged member takes their own tag off a post; the author isn't told.
   * Answers with who the post still tags, so every row showing it can update.
   */
  async removeTag(
    viewerId: string,
    postId: string,
  ): Promise<{ postId: string; tagged: TaggedMemberVM[]; taggedMe: false }> {
    const removed = await this.db
      .delete(postTag)
      .where(and(eq(postTag.postId, postId), eq(postTag.userId, viewerId)))
      .returning({ postId: postTag.postId });
    if (!removed.length) throw new NotFoundException("You aren't tagged in this post.");
    const left = await tagsOn(this.db, [postId], viewerId);
    return { postId, tagged: left.get(postId) ?? [], taggedMe: false };
  }

  /** Friends to offer in the composer's tag picker. */
  async tagSuggestions(viewerId: string, query: string) {
    const rows = await tagSuggestions(this.db, viewerId, query);
    return {
      items: await Promise.all(
        rows.map(async ({ avatarKey, ...member }) => ({
          ...member,
          avatarUrl: avatarKey ? await this.storage.presignDownload(avatarKey, "sm") : null,
        })),
      ),
    };
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

const isId = (v: string | null): v is string => v !== null;

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.floor(n)));
}

/** An unparseable cursor is treated as "start from the top" rather than an error. */
export function parseCursor(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
