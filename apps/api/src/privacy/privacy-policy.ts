import { getTableName, sql, type AnyColumn, type GetColumnData, type SQL } from "drizzle-orm";

import continents from "./country-continents";

export const PRIVACY_FIELDS = [
  "directory",
  "profilePhoto",
  "coverPhoto",
  "bio",
  "location",
  "interests",
  "relationshipStatus",
  "followersFollowing",
  "posts",
  "media",
  "onlineStatus",
  "tagging",
  "stories",
  "pinnedPosts",
  "sharedContent",
  "search",
  "readReceipts",
  "messaging",
] as const;
export const PRIVACY_AUDIENCES = [
  "friends",
  "followers",
  "following",
  "members",
  "country",
  "continent",
  "verified",
  "onlyMe",
] as const;
export type PrivacyField = (typeof PRIVACY_FIELDS)[number];
export type PrivacyAudience = (typeof PRIVACY_AUDIENCES)[number];
export type PrivacySettings = Partial<Record<PrivacyField, PrivacyAudience>>;
const LEGACY_PRIVATE_FIELDS: readonly PrivacyField[] = [
  "bio",
  "interests",
  "relationshipStatus",
  "media",
];

export function effectivePrivacy(
  settings: PrivacySettings | null | undefined,
  legacy: string,
): Record<PrivacyField, PrivacyAudience> {
  return Object.fromEntries(
    PRIVACY_FIELDS.map((key) => [
      key,
      settings?.[key] ??
        (legacy === "friends" && LEGACY_PRIVATE_FIELDS.includes(key) ? "friends" : "members"),
    ]),
  ) as Record<PrivacyField, PrivacyAudience>;
}

/** Keep outer references qualified even in Drizzle's single-table projections. */
function identity(value: string | AnyColumn) {
  return typeof value === "string"
    ? sql`${value}`
    : sql`${sql.identifier(getTableName(value.table))}.${sql.identifier(value.name)}`;
}

function audienceAllows(viewer: SQL, owner: SQL, key: PrivacyField) {
  const fallback = LEGACY_PRIVATE_FIELDS.includes(key)
    ? sql`case when (select privacy_owner.profile_visibility from profile privacy_owner where privacy_owner.user_id=${owner}) = 'friends' then 'friends' else 'members' end`
    : sql`'members'`;
  const audience = sql`coalesce((select settings ->> ${key} from profile_privacy where user_id=${owner}), ${fallback})`;
  const map = JSON.stringify(continents);
  return sql<boolean>`case ${audience}
    when 'members' then true
    when 'friends' then exists (select 1 from friendship where status='accepted' and ((user_a=${viewer} and user_b=${owner}) or (user_a=${owner} and user_b=${viewer})))
    when 'followers' then exists (select 1 from follow where follower_id=${viewer} and following_id=${owner})
    when 'following' then exists (select 1 from follow where follower_id=${owner} and following_id=${viewer})
    when 'country' then exists (select 1 from profile o, profile v where o.user_id=${owner} and v.user_id=${viewer} and nullif(upper(o.country),'')=nullif(upper(v.country),''))
    when 'continent' then exists (select 1 from profile o, profile v where o.user_id=${owner} and v.user_id=${viewer} and (${map}::jsonb ->> upper(o.country))=(${map}::jsonb ->> upper(v.country)))
    when 'verified' then exists (select 1 from bronze_verification b join profile v on v.user_id=b.user_id where b.user_id=${viewer} and b.status='verified' and nullif(b.verified_avatar_key,'') is not null and b.verified_avatar_key=v.avatar_key and b.verified_dob=v.date_of_birth::text and b.verified_gender is not distinct from v.gender)
    else false end`;
}

/**
 * Only these work both ways, as on WhatsApp: hide yours from someone and you don't see theirs,
 * and you can only message members who could message you back.
 * Every other setting is one-way, so narrowing your own never hides anyone else's posts,
 * photos or profile from you (or an organization's pinned posts).
 */
const MUTUAL_FIELDS: readonly PrivacyField[] = ["onlineStatus", "readReceipts", "messaging"];

/** Whether the viewer may see this part of the owner's profile. Blocks hide everything. */
export function privacyAllows(viewerId: string, ownerId: string | AnyColumn, key: PrivacyField) {
  const viewer = identity(viewerId);
  const owner = identity(ownerId);
  const mutual = MUTUAL_FIELDS.includes(key)
    ? sql`and ${audienceAllows(owner, viewer, key)}`
    : sql``;
  return sql<boolean>`(${owner} = ${viewer} or (
    not exists (select 1 from member_block where (blocker_id=${viewer} and blocked_id=${owner}) or (blocker_id=${owner} and blocked_id=${viewer}))
    and ${audienceAllows(viewer, owner, key)}
    ${mutual}
  ))`;
}

export function privateProfileValue<C extends AnyColumn>(
  viewerId: string,
  ownerId: string | AnyColumn,
  key: PrivacyField,
  column: C,
) {
  return sql<GetColumnData<C> | null>`case when ${privacyAllows(viewerId, ownerId, key)} then ${column} else null end`.mapWith(
    column,
  );
}
