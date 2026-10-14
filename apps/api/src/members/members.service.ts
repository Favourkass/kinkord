import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Db, DRIZZLE } from "../db/db.module";
import { notBanned } from "../moderation/admins";
import {
  bronzeVerification,
  follow,
  profile,
  profileMedia,
  suggestionDismissal,
  user,
  walletBalance,
  type PostMediaKind,
  type ProfileMediaKind,
} from "../db/schema";
import { PostsService } from "../posts/posts.service";
import { blockedBy, notBlocking } from "../safety/blocks";
import { containsPattern } from "../push/notifications.service";
import { ONLINE_WINDOW_SECONDS, PresenceService } from "../presence/presence.service";
import { StorageService } from "../storage/storage.service";
import { silverCheck, silverSince } from "../subscriptions/plans";
import { stillVerified } from "../verification/bronze-policy";
import { FollowsService } from "./follows.service";
import {
  cardRoles,
  genderShown,
  rankCandidates,
  resolveShow,
  wantedSide,
  type Show,
} from "./matching";

/** "match" ranks a search: exact name or username, then starts-with, then anywhere. */
export type MembersSort = "recent" | "followers" | "name" | "match";
/** People tab (Figma 1321:14): Friends · Followers · Following · Suggested (+ mutual for the viewer). */
export type FriendsTab = "all" | "mutual" | "followers" | "following" | "suggested";
/** Media tab pills (Figma 1524:1786): All · Profile Photo · Photos · Videos. */
export type MediaFilter = "all" | "profile" | "photos" | "videos";
const MEDIA_KINDS: Record<MediaFilter, ProfileMediaKind[]> = {
  all: ["avatar", "cover"],
  profile: ["avatar"],
  photos: ["cover"],
  videos: [],
};
/** What a Media tab tile can be: an uploaded avatar or cover, or a post attachment. */
export type MediaItemKind = ProfileMediaKind | "photo" | "video";

/** The same pills over post attachments: a photo you posted belongs under "Photos". */
const POST_MEDIA_KINDS: Record<MediaFilter, PostMediaKind[]> = {
  all: ["image", "video"],
  // "Profile Photo" means the avatar itself, which no post can be.
  profile: [],
  photos: ["image"],
  videos: ["video"],
};

export interface ListMembersParams {
  /** Omit to look across every country: search does. */
  country?: string | null;
  /** Omit to list the whole country (CEO, 2026-09-12: "click Nigeria → everyone in Nigeria"). */
  state?: string | null;
  /** Only meaningful together with `state`. */
  lga?: string | null;
  sort: MembersSort;
  /** Name or username to look for, anywhere in either. */
  q?: string | null;
  /** Leave out members who blocked the viewer or whom the viewer blocked, as search does. */
  hideBlocked?: boolean;
  page?: number;
  limit?: number;
}

/** A member whose display name or username contains `term`, case aside. Reads `profile` and `user`. */
export function memberMatches(term: string): SQL {
  const pattern = containsPattern(term);
  return or(ilike(profile.displayName, pattern), ilike(user.username, pattern))!;
}

/** 0 for an exact name or username, 1 when either starts with `term`, else 2: best matches first. */
export function matchRank(term: string): SQL<number> {
  const exact = term.toLowerCase();
  const prefix = `${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return sql<number>`case
    when ${user.username} = ${exact} or lower(${profile.displayName}) = ${exact} then 0
    when ${ilike(user.username, prefix)} or ${ilike(profile.displayName, prefix)} then 1
    else 2 end`;
}

/** Countries the directory serves today; the client renders the rest as "coming soon". */
export const AVAILABLE_COUNTRIES = [{ code: "NG", name: "Nigeria" }] as const;

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;
/** How many nearby members "Kinksters Near You" ranks; the best of them are shown. */
export const SUGGESTION_POOL_SIZE = 300;
/** A card shows this many roles and looking-for values. */
const CARD_LIST_MAX = 3;

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
    private readonly posts: PostsService,
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
   * Member cards for a country, a state within it, or one LGA/area within that state
   * — each click narrows: Nigeria → everyone in Nigeria, Delta → everyone in Delta,
   * Abraka → everyone in Abraka. Newest first by default, with the viewer's follow
   * state on each card. The viewer is excluded.
   */
  /**
   * Everyone matching a name or username, whatever their country: the app's
   * search. Best matches first, and nobody on either side of a block.
   */
  search(viewerId: string, q: string, page?: number, limit?: number) {
    return this.list({ q, sort: "match", hideBlocked: true, page, limit }, viewerId);
  }

  async list(params: ListMembersParams, viewerId: string) {
    const { page, limit, offset } = normalizePaging(params.page, params.limit);
    const conditions: SQL[] = [ne(profile.userId, viewerId), notBanned(profile.userId)];
    if (params.country) conditions.unshift(eq(profile.country, params.country.toUpperCase()));
    if (params.state) conditions.push(eq(profile.state, params.state));
    if (params.state && params.lga) conditions.push(eq(profile.city, params.lga));
    if (params.q) conditions.push(memberMatches(params.q));
    if (params.hideBlocked) {
      conditions.push(
        notBlocking(profile.userId, viewerId),
        sql`not ${blockedBy(viewerId, profile.userId)}`,
      );
    }
    const where = and(...conditions);

    const followerCounts = this.db
      .select({ followingId: follow.followingId, followers: count().as("followers") })
      .from(follow)
      .groupBy(follow.followingId)
      .as("follower_counts");
    const viewerFollow = alias(follow, "viewer_follow");
    const followers = sql<number>`coalesce(${followerCounts.followers}, 0)`;
    // Presence: active within the online window. Online members always list first.
    // last_seen_at holds UTC wall time (see PresenceService.touch), so "now" is UTC too.
    const isOnline = sql<boolean>`coalesce(${profile.lastSeenAt} > timezone('UTC', now()) - (${sql.raw(
      String(ONLINE_WINDOW_SECONDS),
    )} * interval '1 second'), false)`;

    const secondary =
      params.sort === "followers"
        ? desc(followers)
        : params.sort === "name"
          ? asc(profile.displayName)
          : desc(profile.createdAt);
    // A search's best matches lead, then the handle: nothing a follow or a
    // login moves, so its pages never repeat or skip anyone. The directory
    // keeps who's online first. The id settles any tie.
    const order =
      params.sort === "match" && params.q
        ? [asc(matchRank(params.q)), sql`${user.username} asc nulls last`, asc(profile.userId)]
        : [desc(isOnline), secondary, asc(profile.userId)];

    const rows = await this.db
      .select({
        userId: profile.userId,
        username: user.username,
        displayName: profile.displayName,
        avatarKey: profile.avatarKey,
        dateOfBirth: profile.dateOfBirth,
        gender: profile.gender,
        roles: profile.roles,
        city: profile.city,
        state: profile.state,
        country: profile.country,
        lastSeenAt: profile.lastSeenAt,
        isOnline,
        followers,
        isFollowing: sql<boolean>`${viewerFollow.followerId} is not null`,
        silver: silverCheck(profile.userId),
      })
      .from(profile)
      .innerJoin(user, eq(user.id, profile.userId))
      .leftJoin(followerCounts, eq(followerCounts.followingId, profile.userId))
      .leftJoin(
        viewerFollow,
        and(eq(viewerFollow.followingId, profile.userId), eq(viewerFollow.followerId, viewerId)),
      )
      .where(where)
      .orderBy(...order)
      .limit(limit)
      .offset(offset);

    // Joined like the page, since a search reads the username.
    const [totalRow] = await this.db
      .select({ total: count() })
      .from(profile)
      .innerJoin(user, eq(user.id, profile.userId))
      .where(where);

    // One grouped query for the page rather than a count per card.
    const postCounts = await this.posts.postCountsFor(
      rows.map((r) => r.userId),
      viewerId,
    );
    const items = await Promise.all(
      rows.map(async (r) => ({
        userId: r.userId,
        username: r.username,
        displayName: r.displayName,
        // Cards render 139x106 at most, so the medium size is plenty.
        avatarUrl: r.avatarKey ? await this.storage.presignDownload(r.avatarKey, "md") : null,
        age: ageFromDob(r.dateOfBirth),
        gender: r.gender,
        // CEO (2026-09-08): the card's second line is "19F • Submissive" — roles, not gender.
        roles: r.roles ?? [],
        city: r.city,
        state: r.state,
        country: r.country,
        isOnline: Boolean(r.isOnline),
        lastSeenAt: r.lastSeenAt ? r.lastSeenAt.toISOString() : null,
        postsCount: postCounts.get(r.userId) ?? 0,
        followersCount: Number(r.followers ?? 0),
        isFollowing: Boolean(r.isFollowing),
        silver: Boolean(r.silver),
      })),
    );

    return { items, total: Number(totalRow?.total ?? 0), page, limit };
  }

  /** Another member's public profile. Age is derived here so the birth date never leaves the API. */
  async publicProfile(username: string, viewerId: string) {
    const handle = username.replace(/^@/, "").toLowerCase();
    const [row] = await this.db
      .select({
        u: user,
        p: profile,
        bronze: bronzeVerification,
        coins: sql<number>`coalesce((select ${walletBalance.available} from ${walletBalance} where ${walletBalance.userId}=${user.id} and ${user.id}=${viewerId} and ${walletBalance.currency}='coin'),0)`,
      })
      .from(user)
      .innerJoin(profile, eq(profile.userId, user.id))
      .leftJoin(bronzeVerification, eq(bronzeVerification.userId, user.id))
      .where(and(eq(user.username, handle), notBanned(user.id)))
      .limit(1);
    if (!row) throw new NotFoundException("Member not found.");

    const { u, p } = row;
    const isSelf = u.id === viewerId;
    const friendsOnly = p.profileVisibility === "friends" && !isSelf;
    const [followCounts, mutualFriends, isFollowing, avatarUrl, coverUrl, isFriend, silver] =
      await Promise.all([
        this.follows.counts(u.id),
        isSelf ? Promise.resolve(0) : this.follows.mutualFriendsCount(u.id, viewerId),
        isSelf ? Promise.resolve(false) : this.follows.isFollowing(viewerId, u.id),
        p.avatarKey ? this.storage.presignDownload(p.avatarKey, "md") : Promise.resolve(null),
        // Covers are full-bleed, so they keep the original.
        p.coverKey ? this.storage.presignDownload(p.coverKey) : Promise.resolve(null),
        friendsOnly ? this.follows.areFriends(viewerId, u.id) : Promise.resolve(true),
        silverSince(this.db, u.id),
      ]);
    const counts = { ...followCounts, mutualFriends };
    // Friends-only profile seen by a non-friend: what the directory card already shows
    // stays (so they can still follow back), the About details are withheld.
    const restricted = friendsOnly && !isFriend;
    const hidden = <T>(value: T, empty: T) => (restricted ? empty : value);

    return {
      userId: u.id,
      ...(isSelf ? { coinBalance: Number(row.coins ?? 0) } : {}),
      username: u.username,
      displayName: p.displayName,
      avatarUrl,
      coverUrl,
      bio: hidden(p.bio, null),
      country: p.country,
      state: p.state,
      city: p.city,
      age: ageFromDob(p.dateOfBirth),
      gender: p.gender,
      // Sexuality is private: only the member sees their own.
      orientation: isSelf ? p.orientation : null,
      relationshipStatus: hidden(p.relationshipStatus, null),
      bodyType: hidden(p.bodyType, null),
      roles: p.roles ?? [],
      interests: hidden(p.interests ?? [], []),
      lookingFor: hidden(p.lookingFor ?? [], []),
      languages: hidden(p.languages ?? [], []),
      nationality: hidden(p.nationality ?? null, null),
      occupation: hidden(p.occupation ?? null, null),
      limits: hidden(p.limits ?? null, null),
      socialLinks: hidden(p.socialLinks ?? {}, {}),
      joinedAt: u.createdAt.toISOString(),
      lastSeenAt: p.lastSeenAt ? p.lastSeenAt.toISOString() : null,
      isOnline: PresenceService.isOnline(p.lastSeenAt),
      counts,
      isFollowing,
      isSelf,
      restricted,
      // Only you see your own birth date; everyone else gets the derived age.
      dateOfBirth: isSelf ? p.dateOfBirth : null,
      verification: {
        email: u.emailVerified,
        phone: p.phoneVerified,
        // Only while the verified photo, birth date and gender are still the
        // profile's; others see it only if the member shows it and may see them.
        ...(stillVerified(row.bronze, p) && (isSelf || (p.showVerifiedBadge && !restricted))
          ? { identity: true as const }
          : {}),
      },
      // The Silver check, X-style: shown with the month their Silver began.
      silver: silver ? { since: silver.toISOString() } : null,
    };
  }

  /**
   * "Suggested" people for a member: kinksters in their state, those in their own
   * area first (CEO brief, 2026-09-12), excluding the member and the viewer.
   */
  async suggested(targetId: string, viewerId: string, limit: number, offset: number) {
    const [target] = await this.db
      .select({ country: profile.country, state: profile.state, city: profile.city })
      .from(profile)
      .where(eq(profile.userId, targetId));
    if (!target?.state) return { items: [], total: 0 };
    const conditions = [
      eq(profile.state, target.state),
      ne(profile.userId, targetId),
      ne(profile.userId, viewerId),
      notBanned(profile.userId),
    ];
    if (target.country) conditions.push(eq(profile.country, target.country));
    const where = and(...conditions);
    // Same city first when the member has one. Without a city there is nothing
    // to rank by: a constant would render as `order by 0`, which Postgres reads
    // as "output column 0" and rejects.
    const sameAreaFirst = target.city
      ? [desc(sql<number>`case when ${profile.city} = ${target.city} then 1 else 0 end`)]
      : [];
    const viewerFollow = alias(follow, "viewer_follow");
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
        country: profile.country,
        isFollowing: sql<boolean>`${viewerFollow.followerId} is not null`,
        silver: silverCheck(profile.userId),
      })
      .from(profile)
      .innerJoin(user, eq(user.id, profile.userId))
      .leftJoin(
        viewerFollow,
        and(eq(viewerFollow.followerId, viewerId), eq(viewerFollow.followingId, profile.userId)),
      )
      .where(where)
      .orderBy(...sameAreaFirst, desc(profile.createdAt))
      .limit(limit)
      .offset(offset);
    const [totalRow] = await this.db.select({ total: count() }).from(profile).where(where);
    return {
      items: rows.map((r) => ({
        ...r,
        isFollowing: Boolean(r.isFollowing),
        silver: Boolean(r.silver),
      })),
      total: Number(totalRow?.total ?? 0),
    };
  }

  /**
   * "Kinksters Near You" on the home feed, ranked by matching v1 (matching.ts,
   * docs/MATCHING.md). The pool is the viewer's country (their state when they
   * have no country), of the gender `show` lists, leaving out the viewer,
   * suspended members, anyone on either side of a block, and anyone the viewer
   * already follows or removed. The nearest and most recently seen
   * `SUGGESTION_POOL_SIZE` are scored here and the best `limit` returned.
   */
  async suggestedForFeed(viewerId: string, limitArg?: number, requested?: Show) {
    const { limit } = normalizePaging(1, limitArg ?? 10);
    const [me] = await this.db
      .select({
        gender: profile.gender,
        orientation: profile.orientation,
        roles: profile.roles,
        interests: profile.interests,
        lookingFor: profile.lookingFor,
        country: profile.country,
        state: profile.state,
        city: profile.city,
      })
      .from(profile)
      .where(eq(profile.userId, viewerId));
    // The viewer's own sexuality, never anyone else's.
    const { show, options } = resolveShow(requested, me?.gender, me?.orientation);
    if (!me || (!me.country && !me.state)) return { items: [], show, options };

    const conditions: SQL[] = [
      me.country ? eq(profile.country, me.country) : eq(profile.state, me.state as string),
      ne(profile.userId, viewerId),
      notBanned(profile.userId),
      notBlocking(profile.userId, viewerId),
      sql`not ${blockedBy(viewerId, profile.userId)}`,
      sql`not exists (select 1 from ${follow} where ${follow.followerId} = ${viewerId} and ${follow.followingId} = ${profile.userId})`,
      sql`not exists (select 1 from ${suggestionDismissal} where ${suggestionDismissal.userId} = ${viewerId} and ${suggestionDismissal.dismissedUserId} = ${profile.userId})`,
    ];
    const gender = genderShown(show);
    // Sign-up stored "female", Edit Profile "Female".
    if (gender) conditions.push(sql`lower(${profile.gender}) = ${gender.toLowerCase()}`);
    // Without a state there is no "same state" to put first (and a constant would be `order by 0`).
    const sameStateFirst = me.state
      ? [desc(sql<number>`case when ${profile.state} = ${me.state} then 1 else 0 end`)]
      : [];

    const rows = await this.db
      .select({
        userId: profile.userId,
        username: user.username,
        displayName: profile.displayName,
        avatarKey: profile.avatarKey,
        dateOfBirth: profile.dateOfBirth,
        gender: profile.gender,
        country: profile.country,
        state: profile.state,
        city: profile.city,
        roles: profile.roles,
        interests: profile.interests,
        lookingFor: profile.lookingFor,
        lastSeenAt: profile.lastSeenAt,
        createdAt: user.createdAt,
        silver: silverCheck(profile.userId),
      })
      .from(profile)
      .innerJoin(user, eq(user.id, profile.userId))
      .where(and(...conditions))
      .orderBy(...sameStateFirst, sql`${profile.lastSeenAt} desc nulls last`)
      .limit(SUGGESTION_POOL_SIZE);

    const now = new Date();
    const viewer = {
      roles: me.roles ?? [],
      kinks: me.interests ?? [],
      lookingFor: me.lookingFor ?? [],
      city: me.city,
      state: me.state,
    };
    const candidates = rows.map((r) => ({
      ...r,
      roles: r.roles ?? [],
      kinks: r.interests ?? [],
      lookingFor: r.lookingFor ?? [],
      hasPhoto: Boolean(r.avatarKey),
    }));
    const wanted = wantedSide(viewer.roles);
    const best = rankCandidates(viewer, candidates, now).slice(0, limit);
    const items = await Promise.all(
      best.map(async (r) => ({
        userId: r.userId,
        username: r.username,
        displayName: r.displayName,
        // The card is a tall photo, not a 48px row: the medium size.
        avatarUrl: r.avatarKey ? await this.storage.presignDownload(r.avatarKey, "md") : null,
        age: ageFromDob(r.dateOfBirth, now),
        gender: r.gender,
        city: r.city,
        state: r.state,
        country: r.country,
        roles: cardRoles(r.roles, wanted, CARD_LIST_MAX),
        lookingFor: r.lookingFor.slice(0, CARD_LIST_MAX),
        online: PresenceService.isOnline(r.lastSeenAt, now),
        silver: Boolean(r.silver),
        // Members the viewer follows are never in the pool.
        isFollowing: false,
      })),
    );
    return { items, show, options };
  }

  /** Remove for good: the viewer is never suggested this member again. Doing it twice is the same as once. */
  async dismissSuggestion(viewerId: string, dismissedUserId: string) {
    if (viewerId === dismissedUserId) {
      throw new BadRequestException("You can't remove yourself from your suggestions.");
    }
    const [target] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, dismissedUserId))
      .limit(1);
    if (!target) throw new NotFoundException("Member not found.");
    await this.db
      .insert(suggestionDismissal)
      .values({ userId: viewerId, dismissedUserId })
      .onConflictDoNothing();
    return { dismissed: dismissedUserId };
  }

  /**
   * Media tab: the member's uploaded profile photos and covers, newest first. Friends-only
   * profiles show nothing to non-friends. `isCurrent` marks the photo in use right now.
   */
  async media(
    username: string,
    viewerId: string,
    filter: MediaFilter,
    pageArg?: number,
    limitArg?: number,
  ) {
    const targetId = await this.follows.resolveUserId(username);
    const { page, limit, offset } = normalizePaging(pageArg, limitArg);
    const [p] = await this.db
      .select({
        avatarKey: profile.avatarKey,
        coverKey: profile.coverKey,
        visibility: profile.profileVisibility,
      })
      .from(profile)
      .where(eq(profile.userId, targetId));
    if (!p) throw new NotFoundException("Member not found.");
    const isSelf = targetId === viewerId;
    const restricted =
      p.visibility === "friends" && !isSelf && !(await this.follows.areFriends(viewerId, targetId));
    const kinds = MEDIA_KINDS[filter];
    const postKinds = POST_MEDIA_KINDS[filter];
    if (restricted || (kinds.length === 0 && postKinds.length === 0)) {
      return { items: [], total: 0, page, limit, restricted };
    }

    // Two sources, both newest-first: uploaded avatars and covers, and the
    // photos attached to posts. Each is read up to `offset + limit` and the two
    // are merged, which is exactly right for merging sorted lists and is bounded
    // because the page size is capped.
    const reach = offset + limit;
    const where = and(eq(profileMedia.userId, targetId), inArray(profileMedia.kind, kinds));
    const [uploaded, uploadedTotal, fromPosts] = await Promise.all([
      kinds.length
        ? this.db
            .select()
            .from(profileMedia)
            .where(where)
            .orderBy(desc(profileMedia.createdAt))
            .limit(reach)
        : Promise.resolve([]),
      kinds.length
        ? this.db.select({ total: count() }).from(profileMedia).where(where)
        : Promise.resolve([{ total: 0 }]),
      this.posts.postMediaFor(targetId, viewerId, postKinds, reach, 0),
    ]);

    const merged = [
      ...uploaded.map((r) => ({
        id: r.id,
        kind: r.kind as MediaItemKind,
        key: r.key,
        createdAt: r.createdAt,
        isCurrent: r.key === (r.kind === "avatar" ? p.avatarKey : p.coverKey),
      })),
      ...fromPosts.rows.map((r) => ({
        id: r.id,
        // A post attachment is a plain photo or video on the profile grid; only
        // an uploaded avatar can be the "current" one.
        kind: (r.kind === "video" ? "video" : "photo") as MediaItemKind,
        key: r.key,
        createdAt: r.createdAt,
        isCurrent: false,
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + limit);

    const items = await Promise.all(
      merged.map(async (r) => ({
        id: r.id,
        kind: r.kind,
        // Grid tiles use the medium size; the lightbox opens the original.
        url: await this.storage.presignDownload(r.key, "md"),
        fullUrl: await this.storage.presignDownload(r.key),
        createdAt: r.createdAt.toISOString(),
        isCurrent: r.isCurrent,
        /** Post attachments are not deletable from here — they belong to a post. */
        deletable: r.kind === "avatar" || r.kind === "cover",
      })),
    );
    const total = Number(uploadedTotal[0]?.total ?? 0) + fromPosts.total;
    return { items, total, page, limit, restricted: false };
  }

  /** A member's friends ("all" = their mutual follows; "mutual" = friends in common with the viewer). */
  async friends(
    username: string,
    viewerId: string,
    tab: FriendsTab,
    pageArg?: number,
    limitArg?: number,
  ) {
    const targetId = await this.follows.resolveUserId(username);
    const { page, limit, offset } = normalizePaging(pageArg, limitArg);
    const result =
      tab === "mutual"
        ? await this.follows.mutualFriends(targetId, viewerId, limit, offset)
        : tab === "followers"
          ? await this.follows.followers(targetId, viewerId, limit, offset)
          : tab === "following"
            ? await this.follows.following(targetId, viewerId, limit, offset)
            : tab === "suggested"
              ? await this.suggested(targetId, viewerId, limit, offset)
              : await this.follows.friends(targetId, viewerId, limit, offset);
    const items = await Promise.all(
      result.items.map(async (r) => ({
        userId: r.userId,
        username: r.username,
        displayName: r.displayName,
        avatarUrl: r.avatarKey ? await this.storage.presignDownload(r.avatarKey, "sm") : null,
        // Same rule as the directory cards: age is derived, the birth date never leaves the API.
        age: ageFromDob(r.dateOfBirth),
        gender: r.gender,
        city: r.city,
        state: r.state,
        country: r.country,
        isFollowing: r.isFollowing,
        silver: r.silver,
      })),
    );
    return { items, total: result.total, page, limit };
  }
}
