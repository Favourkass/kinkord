import { FOUNDER_SILVER_UNTIL } from "./plans";
import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  ilike,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { DRIZZLE, type Db } from "../db/db.module";
import { kinkRing, memberSubscription, profile, user } from "../db/schema";
import { acceptedFriendship } from "../members/friendship-policy";
import { notBanned } from "../moderation/admins";
import { privacyAllows, privateProfileValue } from "../privacy/privacy-policy";
import { noBlockEitherWay } from "../safety/blocks";
import { StorageService } from "../storage/storage.service";

const PAGE_SIZE = 20;
@Injectable()
export class KinkRingsInventoryService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly storage: StorageService,
  ) {}

  async inventory(ownerId: string, now = new Date()) {
    const [available, expired, history] = await Promise.all([
      this.db
        .select({
          id: kinkRing.id,
          createdAt: kinkRing.createdAt,
          expiresAt: kinkRing.expiresAt,
          paymentId: kinkRing.paymentId,
        })
        .from(kinkRing)
        .where(
          and(eq(kinkRing.ownerId, ownerId), isNull(kinkRing.givenAt), gt(kinkRing.expiresAt, now)),
        )
        .orderBy(asc(kinkRing.expiresAt), asc(kinkRing.id)),
      this.expired(ownerId, 1, now),
      this.history(ownerId, 1, now),
    ]);
    return { available: available.map(ringDto), expired, history };
  }

  async expired(ownerId: string, page: number, now = new Date()) {
    const filter = and(
      eq(kinkRing.ownerId, ownerId),
      isNull(kinkRing.givenAt),
      lte(kinkRing.expiresAt, now),
    );
    const [rows, totals] = await Promise.all([
      this.db
        .select({
          id: kinkRing.id,
          createdAt: kinkRing.createdAt,
          expiresAt: kinkRing.expiresAt,
          paymentId: kinkRing.paymentId,
        })
        .from(kinkRing)
        .where(filter)
        .orderBy(desc(kinkRing.expiresAt), desc(kinkRing.id))
        .limit(PAGE_SIZE + 1)
        .offset((page - 1) * PAGE_SIZE),
      this.db.select({ total: count() }).from(kinkRing).where(filter),
    ]);
    return {
      items: rows.slice(0, PAGE_SIZE).map(ringDto),
      total: Number(totals[0]?.total ?? 0),
      nextPage: rows.length > PAGE_SIZE ? page + 1 : null,
    };
  }

  async history(ownerId: string, page: number, now = new Date()) {
    const visible = and(noBlockEitherWay(user.id, ownerId), notBanned(user.id));
    const rows = await this.db
      .select({
        id: kinkRing.id,
        givenAt: kinkRing.givenAt,
        username: user.username,
        name: profile.displayName,
        avatarKey: privateProfileValue(ownerId, profile.userId, "profilePhoto", profile.avatarKey),
        silverEnd: memberSubscription.currentPeriodEnd,
      })
      .from(kinkRing)
      .leftJoin(user, and(eq(user.id, kinkRing.givenTo), visible))
      .leftJoin(profile, eq(profile.userId, user.id))
      .leftJoin(memberSubscription, eq(memberSubscription.userId, user.id))
      .where(and(eq(kinkRing.ownerId, ownerId), isNotNull(kinkRing.givenAt)))
      .orderBy(desc(kinkRing.givenAt), desc(kinkRing.id))
      .limit(PAGE_SIZE + 1)
      .offset((page - 1) * PAGE_SIZE);
    return {
      items: await Promise.all(
        rows.slice(0, PAGE_SIZE).map(async (r) => ({
          id: r.id,
          givenAt: r.givenAt!.toISOString(),
          to: r.name
            ? {
                username: r.username,
                name: r.name,
                avatarUrl: r.avatarKey
                  ? await this.storage.presignDownload(r.avatarKey, "sm")
                  : null,
              }
            : null,
          // This is the recipient's current Silver state, not a fabricated historical grant expiry.
          status: !r.name ? "gifted" : r.silverEnd && r.silverEnd > now ? "active" : "expired",
        })),
      ),
      nextPage: rows.length > PAGE_SIZE ? page + 1 : null,
    };
  }

  async recipients(viewerId: string, tab: "friends" | "search", query: string, page: number) {
    const q = query.trim().slice(0, 64);
    if (tab === "search" && q.replace(/^@/, "").length < 2) return { items: [], nextPage: null };
    const pattern = `%${q.replace(/^@/, "").replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const rows = await this.db
      .select({
        userId: user.id,
        username: user.username,
        name: profile.displayName,
        avatarKey: privateProfileValue(viewerId, user.id, "profilePhoto", profile.avatarKey),
        city: privateProfileValue(viewerId, user.id, "location", profile.city),
        country: privateProfileValue(viewerId, user.id, "location", profile.country),
        lastSeenAt: privateProfileValue(viewerId, user.id, "onlineStatus", profile.lastSeenAt),
        // A ring's note is a message, so it's offered only where messaging is.
        canMessage: privacyAllows(viewerId, user.id, "messaging"),
      })
      .from(user)
      .innerJoin(profile, eq(profile.userId, user.id))
      .where(
        and(
          ne(user.id, viewerId),
          isNotNull(user.username),
          ne(profile.accountType, "organization"),
          notBanned(user.id),
          noBlockEitherWay(user.id, viewerId),
          tab === "friends"
            ? acceptedFriendship(viewerId, user.id)
            : privacyAllows(viewerId, user.id, "search"),
          q ? or(ilike(user.username, pattern), ilike(profile.displayName, pattern)) : undefined,
          sql`not exists (select 1 from ${memberSubscription} s where s.user_id = ${user.id} and s.current_period_end >= ${FOUNDER_SILVER_UNTIL.toISOString()}::timestamptz)`,
        ),
      )
      .orderBy(asc(profile.displayName), asc(user.id))
      .limit(PAGE_SIZE + 1)
      .offset((page - 1) * PAGE_SIZE);
    return {
      items: await Promise.all(
        rows.slice(0, PAGE_SIZE).map(async (r) => ({
          userId: r.userId,
          username: r.username!,
          name: r.name,
          avatarUrl: r.avatarKey ? await this.storage.presignDownload(r.avatarKey, "sm") : null,
          city: r.city,
          country: r.country,
          online: Boolean(r.lastSeenAt && Date.now() - r.lastSeenAt.getTime() < 5 * 60_000),
          canMessage: Boolean(r.canMessage),
        })),
      ),
      nextPage: rows.length > PAGE_SIZE ? page + 1 : null,
    };
  }
}
function ringDto(r: { id: string; createdAt: Date; expiresAt: Date; paymentId: string | null }) {
  return {
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
    source: r.paymentId ? ("purchase" as const) : ("award" as const),
  };
}
