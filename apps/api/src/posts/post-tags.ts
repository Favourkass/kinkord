import { BadRequestException } from "@nestjs/common";
import { and, asc, eq, ilike, inArray, ne, or, sql, type AnyColumn } from "drizzle-orm";
import type { Db } from "../db/db.module";
import { postTag, profile, user } from "../db/schema";
import { acceptedFriendship } from "../members/friendship-policy";
import { notBanned } from "../moderation/admins";
import { containsPattern } from "../push/notifications.service";
import { noBlockEitherWay } from "../safety/blocks";

/** The most members one post tags, as with mentions. */
export const MAX_TAGS = 10;

/** Someone tagged in a post, as the post shows them. */
export interface TaggedMemberVM {
  userId: string;
  username: string | null;
  displayName: string;
}

/** Said when a tag names anyone but a friend: tags only reach people the author knows. */
export const TAG_FRIENDS_ONLY = "You can only tag your friends.";

/**
 * The members `usernames` name, for the author to tag: each must be the
 * author's accepted friend, not suspended, and with no block either way. A
 * stranger can't be put on a post, so a tag is never a way to reach, or out,
 * someone who never agreed to know the author. Refuses the whole post rather
 * than dropping a tag, so the author knows who wasn't tagged.
 */
export async function taggableIds(
  db: Db,
  authorId: string,
  usernames: string[],
): Promise<string[]> {
  const handles = [...new Set(usernames.map((u) => u.trim().replace(/^@/, "").toLowerCase()))];
  if (!handles.length) return [];
  if (handles.length > MAX_TAGS) {
    throw new BadRequestException(`You can tag up to ${MAX_TAGS} people in a post.`);
  }
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .innerJoin(profile, eq(profile.userId, user.id))
    .where(
      and(
        inArray(user.username, handles),
        ne(user.id, authorId),
        // An organization's account has followers, not friends to be tagged as.
        eq(profile.accountType, "person"),
        notBanned(user.id),
        noBlockEitherWay(user.id, authorId),
        acceptedFriendship(user.id, authorId),
      ),
    );
  if (rows.length !== handles.length) throw new BadRequestException(TAG_FRIENDS_ONLY);
  return rows.map((r) => r.id);
}

/**
 * Who each post tags, as the viewer may see them: nobody suspended, and
 * nobody on either side of a block with the viewer.
 */
export async function tagsOn(
  db: Db,
  postIds: string[],
  viewerId: string,
): Promise<Map<string, TaggedMemberVM[]>> {
  const byPost = new Map<string, TaggedMemberVM[]>();
  if (!postIds.length) return byPost;
  const rows =
    (await db
      .select({
        postId: postTag.postId,
        userId: user.id,
        username: user.username,
        displayName: profile.displayName,
      })
      .from(postTag)
      .innerJoin(user, eq(user.id, postTag.userId))
      .innerJoin(profile, eq(profile.userId, user.id))
      .where(
        and(
          inArray(postTag.postId, postIds),
          notBanned(user.id),
          noBlockEitherWay(user.id, viewerId),
        ),
      )
      .orderBy(asc(postTag.createdAt), asc(user.id))) ?? [];
  for (const { postId, ...member } of rows) {
    byPost.set(postId, [...(byPost.get(postId) ?? []), member]);
  }
  return byPost;
}

/** SQL: the post (a row of `post`) tags this member: the profile's Tagged tab. */
export function tags(postId: AnyColumn, userId: string) {
  return sql`exists (select 1 from ${postTag} where ${postTag.postId} = ${postId} and ${postTag.userId} = ${userId})`;
}

/** Friends to offer in the composer's tag picker, by name or username. */
export async function tagSuggestions(db: Db, viewerId: string, query: string, limit = 10) {
  const q = query.trim().replace(/^@/, "").slice(0, 64);
  const pattern = containsPattern(q);
  return db
    .select({
      userId: user.id,
      username: user.username,
      displayName: profile.displayName,
      avatarKey: profile.avatarKey,
    })
    .from(user)
    .innerJoin(profile, eq(profile.userId, user.id))
    .where(
      and(
        ne(user.id, viewerId),
        eq(profile.accountType, "person"),
        acceptedFriendship(user.id, viewerId),
        notBanned(user.id),
        noBlockEitherWay(user.id, viewerId),
        q ? or(ilike(user.username, pattern), ilike(profile.displayName, pattern)) : undefined,
      ),
    )
    .orderBy(asc(profile.displayName))
    .limit(limit);
}
