import { and, eq, isNull, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { follow, post } from "../db/schema";
import { groupReadableBy } from "../groups/group-policy";
import { acceptedFriendship } from "../members/friendship-policy";
import { notBanned } from "../moderation/admins";

/** A `follow` alias joined to the post's author: the viewer's follow of them, or theirs of the viewer. */
export type FollowAlias = ReturnType<typeof alias<typeof follow, string>>;

export interface VisibilityOptions {
  /**
   * Include group discussions the viewer may read. Only a group's own reads
   * (its discussions, one discussion, its replies and likes) ask for this;
   * everything else leaves it off, so nothing posted in a group ever reaches a
   * feed, a profile, search, a repost or a gift.
   */
  groups?: boolean;
}

/**
 * The one visibility rule: anything public, everything of the viewer's own, and
 * friends-only posts between two members with an accepted friendship, never from a
 * suspended author. The feed and its tabs, the post counts and the profile
 * Media tab all go through this, because several copies of it would eventually
 * disagree and leak somebody's friends-only post.
 */
export function visibleTo(
  viewerId: string,
  _viewerFollows: FollowAlias,
  _authorFollows: FollowAlias,
  { groups = false }: VisibilityOptions = {},
) {
  return and(
    isNull(post.archivedAt),
    notBanned(post.authorId),
    groups
      ? or(isNull(post.groupId), groupReadableBy(viewerId, post.groupId))
      : isNull(post.groupId),
    or(
      eq(post.visibility, "public"),
      eq(post.authorId, viewerId),
      and(eq(post.visibility, "friends"), acceptedFriendship(viewerId, post.authorId)),
    ),
  );
}
