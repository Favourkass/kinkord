import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

/** Open: anyone joins and any member reads. Closed: moderators approve each join; only members read. */
export type GroupPrivacy = "open" | "closed";
export type GroupRole = "owner" | "moderator" | "member";
/** Pending: asked to join a closed group, not yet approved. */
export type GroupMemberStatus = "active" | "pending";

/**
 * A group: a members' forum around a place or an interest, FetLife-style.
 * ("group" is an SQL keyword, hence the table name.) Groups are never torn out
 * of the database; closing one down sets `archivedAt`, which hides it and
 * everything in it.
 */
export const communityGroup = pgTable(
  "community_group",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * The group's address, /g/<slug>. Made once from the name and never changed,
     * so links and notifications keep working when the group is renamed.
     */
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    rules: text("rules"),
    /** One of GROUP_CATEGORIES (groups/group-options.ts). */
    category: text("category").notNull(),
    privacy: text("privacy").$type<GroupPrivacy>().notNull().default("open"),
    /** Where a local group meets; empty for groups about an interest. */
    country: text("country"),
    state: text("state"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("community_group_slug_idx").on(t.slug),
    index("community_group_place_idx").on(t.country, t.state),
    check("community_group_privacy", sql`${t.privacy} in ('open', 'closed')`),
  ],
);

/**
 * Who belongs to a group and in what role. Ownership lives here too (one
 * `owner` row per group), so there is one place that says who runs it.
 */
export const groupMember = pgTable(
  "group_member",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => communityGroup.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").$type<GroupRole>().notNull().default("member"),
    status: text("status").$type<GroupMemberStatus>().notNull().default("active"),
    /** When they joined, or asked to. */
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    /** When they became a member: at once in an open group, on approval in a closed one. */
    joinedAt: timestamp("joined_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.userId] }),
    index("group_member_user_idx").on(t.userId, t.status),
    index("group_member_group_idx").on(t.groupId, t.status, t.role),
    // One owner per group: the rule is the index.
    uniqueIndex("group_member_one_owner_idx")
      .on(t.groupId)
      .where(sql`${t.role} = 'owner'`),
    check("group_member_role", sql`${t.role} in ('owner', 'moderator', 'member')`),
    check("group_member_status", sql`${t.status} in ('active', 'pending')`),
  ],
);

/**
 * Every moderator action in a group: who did what to whom. Kept so members and
 * Kinkord can see how a group is run (FetLife's moderators answer to no one).
 */
export const groupLog = pgTable(
  "group_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => communityGroup.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    subjectUserId: text("subject_user_id").references(() => user.id, { onDelete: "set null" }),
    /** The discussion acted on. Not a foreign key: post.ts already points at this table. */
    subjectPostId: uuid("subject_post_id"),
    action: text("action").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("group_log_group_idx").on(t.groupId, t.createdAt)],
);
