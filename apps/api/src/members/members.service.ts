import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, count, desc, eq, isNotNull, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Db, DRIZZLE } from "../db/db.module";
import { follow, profile, user } from "../db/schema";
import { ONLINE_WINDOW_SECONDS, PresenceService } from "../presence/presence.service";
import { StorageService } from "../storage/storage.service";
import { FollowsService } from "./follows.service";

export type MembersSort = "recent" | "followers" | "name";

export interface ListMembersParams {
  country: string;
  state: string;
  lga?: string | null;
  sort: MembersSort;
  page?: number;
  limit?: number;
}

/** Countries the directory serves today; the client renders the rest as "coming soon". */
export const AVAILABLE_COUNTRIES = [{ code: "NG", name: "Nigeria" }] as const;

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

/** Whole years from a YYYY-MM-DD birth date to `now`; null when unknown/invalid. */
export function ageFromDob(dob: string | null | undefined, now = new Date()): number | null {
  if (!dob) return null;
  const d = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const months = now.getUTCMonth() - d.getUTCMonth();
  if (months < 0 || (months === 0 && now.getUTCDate() < d.getUTCDate())) age -= 1;
  return age >= 0 ? age : null;
}

/** Clamp paging so a client can never request an unbounded page. */
export function normalizePaging(page?: number, limit?: number) {
  const p = Math.max(1, Math.floor(page ?? 1));
  const l = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(limit ?? DEFAULT_PAGE_SIZE)));
  return { page: p, limit: l, offset: (p - 1) * l };
}

@Injectable()
export class MembersService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly storage: StorageService,
    private readonly follows: FollowsService,
  ) {}

  /** Available countries with how many members have set that country. */
  async countries() {
    const rows = await this.db
      .select({ country: profile.country, members: count() })
      .from(profile)
      .where(isNotNull(profile.country))
      .groupBy(profile.country);
    const byCode = new Map(rows.map((r) => [r.country, Number(r.members)]));
    return AVAILABLE_COUNTRIES.map((c) => ({
      code: c.code,
      name: c.name,
      membersCount: byCode.get(c.code) ?? 0,
    }));
  }

  /** Member counts per state within a country (states with zero members are omitted). */
  async states(country: string) {
    const rows = await this.db
      .select({ state: profile.state, members: count() })
      .from(profile)
      .where(and(eq(profile.country, country.toUpperCase()), isNotNull(profile.state)))
      .groupBy(profile.state);
    return rows
      .filter((r): r is { state: string; members: number } => Boolean(r.state))
      .map((r) => ({ state: r.state, membersCount: Number(r.members) }));
  }

  /**
   * Member cards for a state (optionally narrowed to an LGA/area), newest first by
   * default, with the viewer's follow state on each card. The viewer is excluded.
   */
  async list(params: ListMembersParams, viewerId: string) {
    const { page, limit, offset } = normalizePaging(params.page, params.limit);
    const conditions = [
      eq(profile.country, params.country.toUpperCase()),
      eq(profile.state, params.state),
      ne(profile.userId, viewerId),
    ];
    if (params.lga) conditions.push(eq(profile.city, params.lga));
    const where = and(...conditions);

    const followerCounts = this.db
      .select({ followingId: follow.followingId, followers: count().as("followers") })
      .from(follow)
      .groupBy(follow.followingId)
      .as("follower_counts");
    const viewerFollow = alias(follow, "viewer_follow");
    const followers = sql<number>`coalesce(${followerCounts.followers}, 0)`;
    // Presence: active within the online window. Online members always list first.
    const isOnline = sql<boolean>`coalesce(${profile.lastSeenAt} > now() - (${sql.raw(
      String(ONLINE_WINDOW_SECONDS),
    )} * interval '1 second'), false)`;

    const secondary =
      params.sort === "followers"
        ? desc(followers)
        : params.sort === "name"
          ? asc(profile.displayName)
          : desc(profile.createdAt);

    const rows = await this.db
      .select({
        userId: profile.userId,
        username: user.username,
        displayName: profile.displayName,
        avatarKey: profile.avatarKey,
        dateOfBirth: profile.dateOfBirth,
        gender: profile.gender,
        city: profile.city,
        state: profile.state,
        lastSeenAt: profile.lastSeenAt,
        isOnline,
        followers,
        isFollowing: sql<boolean>`${viewerFollow.followerId} is not null`,
      })
      .from(profile)
      .innerJoin(user, eq(user.id, profile.userId))
      .leftJoin(followerCounts, eq(followerCounts.followingId, profile.userId))
      .leftJoin(
        viewerFollow,
        and(eq(viewerFollow.followingId, profile.userId), eq(viewerFollow.followerId, viewerId)),
      )
      .where(where)
      .orderBy(desc(isOnline), secondary)
      .limit(limit)
      .offset(offset);

    const [totalRow] = await this.db.select({ total: count() }).from(profile).where(where);

    const items = await Promise.all(
      rows.map(async (r) => ({
        userId: r.userId,
        username: r.username,
        displayName: r.displayName,
        avatarUrl: r.avatarKey ? await this.storage.presignDownload(r.avatarKey) : null,
        age: ageFromDob(r.dateOfBirth),
        gender: r.gender,
        city: r.city,
        state: r.state,
        isOnline: Boolean(r.isOnline),
        lastSeenAt: r.lastSeenAt ? r.lastSeenAt.toISOString() : null,
        // Posts ship in a later slice; the card slot stays so the layout is final.
        postsCount: 0,
        followersCount: Number(r.followers ?? 0),
        isFollowing: Boolean(r.isFollowing),
      })),
    );

    return { items, total: Number(totalRow?.total ?? 0), page, limit };
  }

  /** Another member's public profile. Age is derived here so the birth date never leaves the API. */
  async publicProfile(username: string, viewerId: string) {
    const handle = username.replace(/^@/, "").toLowerCase();
    const [row] = await this.db
      .select({ u: user, p: profile })
      .from(user)
      .innerJoin(profile, eq(profile.userId, user.id))
      .where(eq(user.username, handle))
      .limit(1);
    if (!row) throw new NotFoundException("Member not found.");

    const { u, p } = row;
    const isSelf = u.id === viewerId;
    const [counts, isFollowing, avatarUrl, coverUrl] = await Promise.all([
      this.follows.counts(u.id),
      isSelf ? Promise.resolve(false) : this.follows.isFollowing(viewerId, u.id),
      p.avatarKey ? this.storage.presignDownload(p.avatarKey) : Promise.resolve(null),
      p.coverKey ? this.storage.presignDownload(p.coverKey) : Promise.resolve(null),
    ]);

    return {
      userId: u.id,
      username: u.username,
      displayName: p.displayName,
      avatarUrl,
      coverUrl,
      bio: p.bio,
      country: p.country,
      state: p.state,
      city: p.city,
      age: ageFromDob(p.dateOfBirth),
      gender: p.gender,
      orientation: p.orientation,
      relationshipStatus: p.relationshipStatus,
      bodyType: p.bodyType,
      roles: p.roles ?? [],
      interests: p.interests ?? [],
      lookingFor: p.lookingFor ?? [],
      languages: p.languages ?? [],
      joinedAt: u.createdAt.toISOString(),
      lastSeenAt: p.lastSeenAt ? p.lastSeenAt.toISOString() : null,
      isOnline: PresenceService.isOnline(p.lastSeenAt),
      counts,
      isFollowing,
      isSelf,
    };
  }
}
