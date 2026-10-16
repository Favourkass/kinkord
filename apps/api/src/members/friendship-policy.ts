import { sql, type AnyColumn } from "drizzle-orm";
import { friendship } from "../db/schema";

export type FriendshipState = "none" | "outgoing" | "incoming" | "friends";

export function orderedPair(a: string, b: string) {
  return a < b ? { userA: a, userB: b } : { userA: b, userB: a };
}

export function friendshipState(
  row: { status: string; requesterId: string } | undefined,
  viewerId: string,
): FriendshipState {
  return !row
    ? "none"
    : row.status === "accepted"
      ? "friends"
      : row.requesterId === viewerId
        ? "outgoing"
        : "incoming";
}

/** Shared by profile privacy, post visibility, and matching. Mutual follows never grant access. */
export function acceptedFriendship(a: string | AnyColumn, b: string | AnyColumn) {
  return sql<boolean>`exists (select 1 from ${friendship} where ${friendship.status} = 'accepted' and ((${friendship.userA} = ${a} and ${friendship.userB} = ${b}) or (${friendship.userA} = ${b} and ${friendship.userB} = ${a})))`;
}

export function friendshipStateSql(viewerId: string, targetId: AnyColumn) {
  return sql<FriendshipState>`coalesce((select case when ${friendship.status} = 'accepted' then 'friends' when ${friendship.requesterId} = ${viewerId} then 'outgoing' else 'incoming' end from ${friendship} where (${friendship.userA} = ${viewerId} and ${friendship.userB} = ${targetId}) or (${friendship.userA} = ${targetId} and ${friendship.userB} = ${viewerId}) limit 1), 'none')`;
}
