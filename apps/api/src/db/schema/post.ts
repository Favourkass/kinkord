import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

/** Who may see a post. Mirrors `profile.profileVisibility`, so the two agree. */
export type PostVisibility = "public" | "friends";

export const POST_BODY_MAX = 2000;
/** A 2×2 grid reads well on a phone and keeps the upload sequence short. */
export const POST_MEDIA_MAX = 4;
export const COMMENT_BODY_MAX = 1000;

/**
 * A member's post. Deletes are soft (`deletedAt`) so a removed post takes its
 * likes and comments out of sight without tearing rows out from under anyone
 * mid-request; the media objects are removed eagerly by the service.
 */
export const post = pgTable(
  "post",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body"),
    visibility: text("visibility").$type<PostVisibility>().notNull().default("public"),
    /**
     * Set when this row is a repost: it carries no words or photos of its own
     * and stands in the feed for the post it points at. A repost is a post so
     * the feed, the profile Posts tab and the visibility rule keep working
     * unchanged, and so a quote-repost can later just fill in `body`.
     */
    repostOfId: uuid("repost_of_id").references((): AnyPgColumn => post.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    // The feed and a profile's Posts tab both read newest-first by author.
    index("post_author_idx").on(t.authorId, t.createdAt),
    index("post_created_idx").on(t.createdAt),
    // Counting reposts of a post, and finding the viewer's own.
    index("post_repost_of_idx").on(t.repostOfId),
    /**
     * One live repost per member per post — the rule is the index, so a double
     * tap cannot leave two. Partial, because a member who un-reposts (soft
     * delete) and reposts again must be allowed to.
     */
    uniqueIndex("post_repost_unique")
      .on(t.authorId, t.repostOfId)
      .where(sql`${t.deletedAt} is null and ${t.repostOfId} is not null`),
  ],
);

export type PostMediaKind = "image" | "video";

/**
 * Photos (and later video) attached to a post, in the order they were added.
 * `key` is the original; the stored sizes derive from it the same way profile
 * photos do, so the grid can load the medium and the lightbox the original.
 */
export const postMedia = pgTable(
  "post_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    kind: text("kind").$type<PostMediaKind>().notNull().default("image"),
    key: text("key").notNull(),
    /** Still frame for a video; null for an image. */
    posterKey: text("poster_key"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("post_media_post_idx").on(t.postId, t.position)],
);

/**
 * One like per member per post — the composite key is the rule, so a double tap
 * cannot count twice however many requests arrive.
 */
export const postLike = pgTable(
  "post_like",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.postId, t.userId] }),
    // "Posts I have liked" reads by member.
    index("post_like_user_idx").on(t.userId),
  ],
);

export const postComment = pgTable(
  "post_comment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("post_comment_post_idx").on(t.postId, t.createdAt)],
);

/**
 * A member's saved posts. Private: nobody is told their post was saved, and no
 * count is shown anywhere — which is why this is a plain table with no
 * aggregate read, unlike likes.
 */
export const postSave = pgTable(
  "post_save",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.postId, t.userId] }),
    // "Saved" reads newest-first by member.
    index("post_save_user_idx").on(t.userId, t.createdAt),
  ],
);
