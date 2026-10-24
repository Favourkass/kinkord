import { privacyAllows, privateProfileValue } from "../privacy/privacy-policy";
import { and, asc, desc, eq, ne, or, type SQL } from "drizzle-orm";
import type { Db } from "../db/db.module";
import { memberRelationship, profile, user, type RelationshipKind } from "../db/schema";
import { notBanned } from "../moderation/admins";
import { noBlockEitherWay } from "../safety/blocks";
import type { StorageService } from "../storage/storage.service";
import { relationshipLabel, sideOf } from "./relationship-types";

/** The other member of a link, as a row beside it shows them. */
export interface RelationshipMember {
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
}

/** A link or a request, from one member's side. */
export interface RelationshipItem {
  id: string;
  kind: RelationshipKind;
  type: string;
  /** Before the other member's name, from this side: "Dominant of", "submissive of", "Married to". */
  label: string;
  member: RelationshipMember;
  /** Whether this side asked: a request this member sent, or one they were sent. */
  requestedBy: "self" | "other";
  createdAt: string;
  acceptedAt: string | null;
}

/**
 * `memberId`'s links that `extra` picks, each beside the other member. Nobody
 * suspended, and nobody on either side of a block with `memberId` or with
 * `viewerId`: a blocked partner reads as gone, as they do everywhere else.
 */
export async function relationshipRows(
  db: Db,
  storage: Pick<StorageService, "presignDownload">,
  memberId: string,
  viewerId: string,
  extra?: SQL,
): Promise<RelationshipItem[]> {
  const rows = await db
    .select({
      id: memberRelationship.id,
      kind: memberRelationship.kind,
      type: memberRelationship.type,
      requesterId: memberRelationship.requesterId,
      createdAt: memberRelationship.createdAt,
      acceptedAt: memberRelationship.acceptedAt,
      userId: user.id,
      username: user.username,
      displayName: profile.displayName,
      avatarKey: privateProfileValue(viewerId, profile.userId, "profilePhoto", profile.avatarKey),
    })
    .from(memberRelationship)
    .innerJoin(
      user,
      and(
        or(eq(memberRelationship.userA, user.id), eq(memberRelationship.userB, user.id)),
        ne(user.id, memberId),
      ),
    )
    .innerJoin(profile, eq(profile.userId, user.id))
    .where(
      and(
        or(eq(memberRelationship.userA, memberId), eq(memberRelationship.userB, memberId)),
        notBanned(user.id),
        noBlockEitherWay(user.id, memberId),
        viewerId === memberId ? undefined : noBlockEitherWay(user.id, viewerId),
        extra,
      ),
    )
    // D/s links first ("ds" sorts before "romantic"), then the longest-standing.
    .orderBy(asc(memberRelationship.kind), desc(memberRelationship.createdAt))
    .limit(100);
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      kind: r.kind,
      type: r.type,
      label: relationshipLabel(r.type, sideOf(r, memberId)),
      member: {
        userId: r.userId,
        username: r.username,
        displayName: r.displayName,
        avatarUrl: r.avatarKey ? await storage.presignDownload(r.avatarKey, "sm") : null,
      },
      requestedBy: r.requesterId === memberId ? ("self" as const) : ("other" as const),
      createdAt: r.createdAt.toISOString(),
      acceptedAt: r.acceptedAt?.toISOString() ?? null,
    })),
  );
}

/** What a profile shows: its owner's accepted links, from the owner's side. */
export function profileRelationships(
  db: Db,
  storage: Pick<StorageService, "presignDownload">,
  memberId: string,
  viewerId: string,
): Promise<RelationshipItem[]> {
  return relationshipRows(
    db,
    storage,
    memberId,
    viewerId,
    and(
      eq(memberRelationship.status, "accepted"),
      privacyAllows(viewerId, memberId, "relationshipStatus"),
      privacyAllows(viewerId, user.id, "relationshipStatus"),
    ),
  );
}
