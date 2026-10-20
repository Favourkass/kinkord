import { and, eq, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db } from "../db/db.module";
import {
  communityGroup,
  groupMember,
  type GroupMemberStatus,
  type GroupPrivacy,
  type GroupRole,
} from "../db/schema";
import { GROUPS_OWNED_MAX, GROUP_CREATE_MIN_ACCOUNT_DAYS } from "./group-options";

export interface Membership {
  role: GroupRole;
  status: GroupMemberStatus;
}

/** What one member may do in one group. Everything else in the module asks this. */
export interface GroupAccess {
  /** A member, not someone waiting for approval. */
  member: boolean;
  pending: boolean;
  /** The discussions and the member list: anyone in an open group, members in a closed one. */
  canRead: boolean;
  /** Start discussions, reply, like: members only. */
  canPost: boolean;
  /** Approve joins, pin, close, remove discussions, replies and members. */
  canModerate: boolean;
  /** Edit the group, make and unmake moderators, close the group down. */
  isOwner: boolean;
}

export function groupAccess(privacy: GroupPrivacy, membership: Membership | null): GroupAccess {
  const member = membership?.status === "active";
  const role = member ? membership.role : null;
  return {
    member,
    pending: membership?.status === "pending",
    canRead: privacy === "open" || member,
    canPost: member,
    canModerate: role === "owner" || role === "moderator",
    isOwner: role === "owner",
  };
}

export type CreateRefusal = "silver" | "new_account" | "limit";

/**
 * Who may create a group: Silver members, plus the founders and admins (who
 * seed Kinkord's own groups). Not a brand-new account, and not past the cap.
 */
export function createRefusal(input: {
  silver: boolean;
  admin: boolean;
  accountCreatedAt: Date;
  owned: number;
  now?: Date;
}): CreateRefusal | null {
  if (!input.silver && !input.admin) return "silver";
  const ageDays = ((input.now ?? new Date()).getTime() - input.accountCreatedAt.getTime()) / 864e5;
  if (!input.admin && ageDays < GROUP_CREATE_MIN_ACCOUNT_DAYS) return "new_account";
  if (input.owned >= GROUPS_OWNED_MAX) return "limit";
  return null;
}

export const CREATE_REFUSALS: Record<CreateRefusal, string> = {
  silver: "Creating a group is part of Silver.",
  new_account: `New accounts can create a group after ${GROUP_CREATE_MIN_ACCOUNT_DAYS} days.`,
  limit: `You can own up to ${GROUPS_OWNED_MAX} groups.`,
};

export async function membershipOf(
  db: Db,
  groupId: string,
  userId: string,
): Promise<Membership | null> {
  const [row] = await db
    .select({ role: groupMember.role, status: groupMember.status })
    .from(groupMember)
    .where(and(eq(groupMember.groupId, groupId), eq(groupMember.userId, userId)))
    .limit(1);
  return row ?? null;
}

// Aliases, so the check reads the same inside any query (an alias renders as
// its bare name in raw SQL, so each table is named with its alias here).
const READABLE = "readable_group";
const READER = "reader_membership";
const readable = alias(communityGroup, READABLE);
const reader = alias(groupMember, READER);

/**
 * SQL: the viewer may read this group's discussions. A live group, and either
 * open or one they're a member of. Waiting for approval doesn't count.
 */
export function groupReadableBy(viewerId: string, groupId: AnyColumn | SQL): SQL<boolean> {
  return sql<boolean>`exists (
    select 1 from ${communityGroup} ${sql.identifier(READABLE)}
    where ${readable.id} = ${groupId}
      and ${readable.archivedAt} is null
      and (${readable.privacy} = 'open' or exists (
        select 1 from ${groupMember} ${sql.identifier(READER)}
        where ${reader.groupId} = ${readable.id}
          and ${reader.userId} = ${viewerId}
          and ${reader.status} = 'active'
      ))
  )`;
}
