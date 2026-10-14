import { and, eq, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { follow, post } from "../db/schema";
import { notBanned } from "../moderation/admins";

/** A `follow` alias joined to the post's author: the viewer's follow of them, or theirs of the viewer. */
export type FollowAlias = ReturnType<typeof alias<typeof follow, string>>;

/**
 * The one visibility rule: anything public, everything of the viewer's own, and
 * friends-only posts between two members who follow each other, never from a
 * suspended author. The feed and its tabs, the post counts and the profile
 * Media tab all go through this, because several copies of it would eventually
 * disagree and leak somebody's friends-only post.
 */
export function visibleTo(
  viewerId: string,
  viewerFollows: FollowAlias,
  authorFollows: FollowAlias,
) {
  return and(
    notBanned(post.authorId),
    or(
      eq(post.visibility, "public"),
      eq(post.authorId, viewerId),
      and(
        eq(post.visibility, "friends"),
        sql`${viewerFollows.followerId} is not null`,
        sql`${authorFollows.followerId} is not null`,
      ),
    ),
  );
}
