import { privacyAllows } from "../privacy/privacy-policy";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { follow, post } from "../db/schema";
import { acceptedFriendship } from "../members/friendship-policy";
import { notBanned } from "../moderation/admins";

/** A `follow` alias joined to the post's author: the viewer's follow of them, or theirs of the viewer. */
export type FollowAlias = ReturnType<typeof alias<typeof follow, string>>;

/**
 * The one visibility rule: anything public, everything of the viewer's own, and
 * friends-only posts between two members with an accepted friendship, never from a
 * suspended author. The feed and its tabs, the post counts and the profile
 * Media tab all go through this, because several copies of it would eventually
 * disagree and leak somebody's friends-only post.
 */
const privacyOriginal = alias(post, "privacy_original");

export function visibleTo(
  viewerId: string,
  _viewerFollows: FollowAlias,
  _authorFollows: FollowAlias,
) {
  return and(
    isNull(post.archivedAt),
    notBanned(post.authorId),
    or(
      eq(post.visibility, "public"),
      eq(post.authorId, viewerId),
      and(eq(post.visibility, "friends"), acceptedFriendship(viewerId, post.authorId)),
    ),
    privacyAllows(viewerId, post.authorId, "posts"),
    sql`(${post.repostOfId} is null or exists (select 1 from ${post} as "privacy_original" where ${privacyOriginal.id}=${post.repostOfId}
      and ${privacyOriginal.visibility}='public' and ${privacyOriginal.deletedAt} is null and ${privacyOriginal.archivedAt} is null
      and ${notBanned(privacyOriginal.authorId)}
      and ${privacyAllows(viewerId, privacyOriginal.authorId, "posts")}
      and ${privacyAllows(viewerId, privacyOriginal.authorId, "sharedContent")}))`,
  );
}
