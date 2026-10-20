import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "../db/db.module";
import { communityGroup, groupMember, type GroupRole } from "../db/schema";

/** One row of a profile's "Groups & Communities" card. */
export interface ProfileGroupVM {
  slug: string;
  name: string;
  role: GroupRole;
  members: number;
}

const PROFILE_GROUPS_MAX = 10;

/**
 * The groups a profile lists: open groups the member is in, the ones they run
 * first. Closed groups never show (being in one is between its members), and a
 * member who hides their groups shows none, except to themselves.
 */
export async function profileGroups(
  db: Db,
  userId: string,
  viewerId: string,
  showGroups: boolean,
): Promise<ProfileGroupVM[]> {
  if (!showGroups && userId !== viewerId) return [];
  const rows = await db
    .select({
      slug: communityGroup.slug,
      name: communityGroup.name,
      role: groupMember.role,
      members: sql<number>`(select count(*)::int from ${groupMember} as everyone where everyone.group_id = ${communityGroup.id} and everyone.status = 'active')`,
    })
    .from(groupMember)
    .innerJoin(communityGroup, eq(communityGroup.id, groupMember.groupId))
    .where(
      and(
        eq(groupMember.userId, userId),
        eq(groupMember.status, "active"),
        eq(communityGroup.privacy, "open"),
        isNull(communityGroup.archivedAt),
      ),
    )
    .orderBy(
      sql`case ${groupMember.role} when 'owner' then 0 when 'moderator' then 1 else 2 end`,
      desc(groupMember.joinedAt),
      asc(communityGroup.slug),
    )
    .limit(PROFILE_GROUPS_MAX);
  return rows.map((r) => ({ ...r, members: Number(r.members) }));
}
