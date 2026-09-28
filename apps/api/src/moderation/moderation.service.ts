import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { DRIZZLE, type Db } from "../db/db.module";
import {
  memberBan,
  moderationLog,
  otpChallenge,
  post,
  postMedia,
  profile,
  profileMedia,
  session,
  signupBlock,
  staff,
  user,
  type SignupRuleAction,
  type SignupRuleKind,
} from "../db/schema";
import { PostsService } from "../posts/posts.service";
import { IMAGE_VARIANTS, StorageService, variantKey } from "../storage/storage.service";
import { isAdmin, isSuperAdmin } from "./admins";
import { normalizeEmail, normalizeIp, normalizePhone } from "./signup-rules";

const SEARCH_LIMIT = 30;
const POSTS_LIMIT = 50;

export interface AdminMemberSummary {
  id: string;
  name: string;
  displayName: string | null;
  username: string | null;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  posts: number;
  banned: boolean;
  admin: boolean;
}

export interface AdminPostSummary {
  id: string;
  body: string | null;
  createdAt: string;
  visibility: string;
  isRepost: boolean;
  mediaCount: number;
  thumbUrl: string | null;
}

export interface AdminBlockRule {
  id: string;
  kind: SignupRuleKind;
  value: string;
  action: SignupRuleAction;
  reason: string | null;
  subjectUserId: string | null;
  createdAt: string;
}

export interface AdminMemberDetail extends AdminMemberSummary {
  ips: string[];
  verifiedPhones: string[];
  banReason: string | null;
  bannedAt: string | null;
  recentPosts: AdminPostSummary[];
  rules: AdminBlockRule[];
}

export interface NewBlockRule {
  kind: SignupRuleKind;
  value: string;
  action: SignupRuleAction;
  reason?: string | null;
}

/** `%` and `_` are wildcards to ILIKE; a search for "tolu_99" means the underscore. */
export function containsPattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export function normalizeRuleValue(kind: SignupRuleKind, value: string): string {
  if (kind === "email") return normalizeEmail(value);
  if (kind === "phone") return normalizePhone(value);
  if (kind === "ip") return normalizeIp(value);
  return value.trim().toLowerCase();
}

type RuleRow = typeof signupBlock.$inferSelect;

function toRule(r: RuleRow): AdminBlockRule {
  return {
    id: r.id,
    kind: r.kind,
    value: r.value,
    action: r.action,
    reason: r.reason,
    subjectUserId: r.subjectUserId,
    createdAt: r.createdAt.toISOString(),
  };
}

@Injectable()
export class ModerationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly storage: StorageService,
    private readonly posts: PostsService,
  ) {}

  private summarySelect() {
    return this.db
      .select({
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        displayName: profile.displayName,
        phone: profile.phone,
        avatarKey: profile.avatarKey,
        lastSeenAt: profile.lastSeenAt,
        posts: sql<number>`(select count(*)::int from ${post} where ${post.authorId} = ${user.id} and ${post.deletedAt} is null)`,
        banned: sql<boolean>`exists (select 1 from ${memberBan} where ${memberBan.userId} = ${user.id})`,
        staff: sql<boolean>`exists (select 1 from ${staff} where ${staff.userId} = ${user.id})`,
      })
      .from(user)
      .leftJoin(profile, eq(profile.userId, user.id));
  }

  private async toSummary(
    r: Awaited<ReturnType<ModerationService["summarySelect"]>>[number],
  ): Promise<AdminMemberSummary> {
    return {
      id: r.id,
      name: r.name,
      displayName: r.displayName,
      username: r.username,
      email: r.email,
      phone: r.phone,
      avatarUrl: r.avatarKey ? await this.storage.presignDownload(r.avatarKey, "sm") : null,
      createdAt: r.createdAt.toISOString(),
      lastSeenAt: r.lastSeenAt?.toISOString() ?? null,
      posts: Number(r.posts),
      banned: Boolean(r.banned),
      admin: Boolean(r.staff) || isSuperAdmin(r),
    };
  }

  /** Newest members first; with a query, anyone whose name, handle, email or phone contains it. */
  async searchMembers(query: string): Promise<AdminMemberSummary[]> {
    const q = query.trim();
    const pattern = containsPattern(q);
    const rows = await this.summarySelect()
      .where(
        q
          ? or(
              ilike(user.name, pattern),
              ilike(profile.displayName, pattern),
              ilike(user.username, pattern),
              ilike(user.email, pattern),
              ilike(profile.phone, pattern),
            )
          : undefined,
      )
      .orderBy(desc(user.createdAt))
      .limit(SEARCH_LIMIT);
    return Promise.all(rows.map((r) => this.toSummary(r)));
  }

  async member(id: string): Promise<AdminMemberDetail> {
    const [row] = await this.summarySelect().where(eq(user.id, id)).limit(1);
    if (!row) throw new NotFoundException("Member not found.");
    const [ban] = await this.db.select().from(memberBan).where(eq(memberBan.userId, id)).limit(1);
    const { ips, verifiedPhones } = await this.contactTrail(id);
    const rules = await this.db
      .select()
      .from(signupBlock)
      .where(eq(signupBlock.subjectUserId, id))
      .orderBy(desc(signupBlock.createdAt));
    return {
      ...(await this.toSummary(row)),
      ips,
      verifiedPhones,
      banReason: ban?.reason ?? null,
      bannedAt: ban?.createdAt.toISOString() ?? null,
      recentPosts: await this.recentPosts(id),
      rules: rules.map(toRule),
    };
  }

  /** Suspends the account, signs it out everywhere and blocks its email, phone and IPs. */
  async block(
    actorId: string,
    id: string,
    opts: { reason?: string | null; deletePosts?: boolean },
  ): Promise<{ blocked: string; postsRemoved: number }> {
    const target = await this.moderatable(actorId, id);
    const reason = opts.reason?.trim() || null;
    // Read before the sessions go: they are where the IPs live.
    const trail = await this.contactTrail(id);
    await this.db
      .insert(memberBan)
      .values({ userId: id, reason, bannedBy: actorId })
      .onConflictDoUpdate({ target: memberBan.userId, set: { reason, bannedBy: actorId } });
    await this.db.delete(session).where(eq(session.userId, id));
    await this.writeRules(id, target, trail, reason);
    const postsRemoved = opts.deletePosts ? await this.purgePostsOf(id) : 0;
    await this.log(actorId, "block", id, null, reason);
    return { blocked: id, postsRemoved };
  }

  /** Lifts the suspension and every sign-up rule written for this member. */
  async unblock(actorId: string, id: string): Promise<{ unblocked: string }> {
    const [row] = await this.db.select({ id: user.id }).from(user).where(eq(user.id, id)).limit(1);
    if (!row) throw new NotFoundException("Member not found.");
    await this.db.delete(memberBan).where(eq(memberBan.userId, id));
    await this.db.delete(signupBlock).where(eq(signupBlock.subjectUserId, id));
    await this.log(actorId, "unblock", id, null, null);
    return { unblocked: id };
  }

  /**
   * Deletes the account and everything that cascades from it: posts, comments,
   * likes, follows, sessions and profile. Their photos are removed from the
   * bucket first, while the rows that name them still exist. With `block`, the
   * sign-up rules are written before the account goes, so they can't return.
   */
  async deleteMember(
    actorId: string,
    id: string,
    opts: { block?: boolean; reason?: string | null },
  ): Promise<{ deleted: string }> {
    const target = await this.moderatable(actorId, id);
    const reason = opts.reason?.trim() || null;
    if (opts.block) await this.writeRules(id, target, await this.contactTrail(id), reason);
    const keys = await this.storedKeysOf(id);
    await Promise.all(
      keys.flatMap((k) => [
        this.storage.remove(k),
        ...IMAGE_VARIANTS.map((v) => this.storage.remove(variantKey(k, v))),
      ]),
    );
    await this.db.delete(user).where(eq(user.id, id));
    const who = [target.username && `@${target.username}`, target.email].filter(Boolean).join(" ");
    await this.log(actorId, opts.block ? "delete+block" : "delete", id, null, `${who}${reason ? ` — ${reason}` : ""}`);
    return { deleted: id };
  }

  async deleteMemberPosts(actorId: string, id: string): Promise<{ postsRemoved: number }> {
    await this.moderatable(actorId, id);
    const postsRemoved = await this.purgePostsOf(id);
    await this.log(actorId, "delete-posts", id, null, `${postsRemoved} posts`);
    return { postsRemoved };
  }

  async deletePost(actorId: string, postId: string): Promise<{ deleted: string }> {
    const { authorId } = await this.posts.removeAsModerator(postId);
    await this.log(actorId, "delete-post", authorId, postId, null);
    return { deleted: postId };
  }

  async rules(): Promise<AdminBlockRule[]> {
    const rows = await this.db.select().from(signupBlock).orderBy(desc(signupBlock.createdAt));
    return rows.map(toRule);
  }

  async addRule(actorId: string, input: NewBlockRule): Promise<AdminBlockRule> {
    const value = normalizeRuleValue(input.kind, input.value);
    const reason = input.reason?.trim() || null;
    const [row] = await this.db
      .insert(signupBlock)
      .values({ kind: input.kind, value, action: input.action, reason })
      .onConflictDoUpdate({
        target: [signupBlock.kind, signupBlock.value],
        set: { action: input.action, reason },
      })
      .returning();
    await this.log(actorId, "add-rule", null, null, `${input.kind}:${value} (${input.action})`);
    return toRule(row);
  }

  async removeRule(actorId: string, ruleId: string): Promise<{ removed: string }> {
    const [row] = await this.db
      .delete(signupBlock)
      .where(eq(signupBlock.id, ruleId))
      .returning({ kind: signupBlock.kind, value: signupBlock.value });
    if (!row) throw new NotFoundException("Rule not found.");
    await this.log(actorId, "remove-rule", null, null, `${row.kind}:${row.value}`);
    return { removed: ruleId };
  }

  /** The target of a block or delete: must exist, and must not be you or another admin. */
  private async moderatable(actorId: string, id: string) {
    if (actorId === id) throw new ForbiddenException("You can't do that to your own account.");
    const [row] = await this.db
      .select({
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        username: user.username,
        phone: profile.phone,
      })
      .from(user)
      .leftJoin(profile, eq(profile.userId, user.id))
      .where(eq(user.id, id))
      .limit(1);
    if (!row) throw new NotFoundException("Member not found.");
    if (await isAdmin(this.db, row)) {
      throw new ForbiddenException("Admins can't be blocked or deleted here.");
    }
    return row;
  }

  /** Where this member has signed in from, and which phones they proved they own. */
  private async contactTrail(id: string) {
    const ipRows = await this.db
      .selectDistinct({ ip: session.ipAddress })
      .from(session)
      .where(eq(session.userId, id));
    const phoneRows = await this.db
      .selectDistinct({ phone: otpChallenge.destination })
      .from(otpChallenge)
      .where(and(eq(otpChallenge.userId, id), eq(otpChallenge.channel, "sms")));
    return {
      ips: ipRows.map((r) => r.ip).filter((ip): ip is string => Boolean(ip)),
      verifiedPhones: phoneRows.map((r) => r.phone),
    };
  }

  /**
   * Email and phones are refused outright. IPs are only flagged: mobile
   * networks here share one address across many subscribers, so blocking it
   * would shut out strangers.
   */
  private async writeRules(
    id: string,
    target: { email: string; phone: string | null },
    trail: { ips: string[]; verifiedPhones: string[] },
    reason: string | null,
  ) {
    const rules = new Map<string, { kind: SignupRuleKind; value: string; action: SignupRuleAction }>();
    const add = (kind: SignupRuleKind, value: string, action: SignupRuleAction) =>
      rules.set(`${kind}:${value}`, { kind, value, action });
    add("email", normalizeEmail(target.email), "block");
    for (const phone of [target.phone, ...trail.verifiedPhones]) {
      if (phone) add("phone", normalizePhone(phone), "block");
    }
    for (const ip of trail.ips) add("ip", normalizeIp(ip), "flag");
    await this.db
      .insert(signupBlock)
      .values([...rules.values()].map((r) => ({ ...r, reason, subjectUserId: id })))
      .onConflictDoNothing();
  }

  private async purgePostsOf(id: string): Promise<number> {
    const rows = await this.db
      .select({ id: post.id })
      .from(post)
      .where(and(eq(post.authorId, id), isNull(post.deletedAt)));
    // One at a time: each removal also clears photos from the bucket.
    for (const r of rows) await this.posts.removeAsModerator(r.id);
    return rows.length;
  }

  /** Every object in the bucket that belongs to this member's posts and profile. */
  private async storedKeysOf(id: string): Promise<string[]> {
    const postKeys = await this.db
      .select({ key: postMedia.key, posterKey: postMedia.posterKey })
      .from(postMedia)
      .innerJoin(post, eq(post.id, postMedia.postId))
      .where(eq(post.authorId, id));
    const profileKeys = await this.db
      .select({ key: profileMedia.key })
      .from(profileMedia)
      .where(eq(profileMedia.userId, id));
    const [own] = await this.db
      .select({ avatarKey: profile.avatarKey, coverKey: profile.coverKey })
      .from(profile)
      .where(eq(profile.userId, id))
      .limit(1);
    const keys = [
      ...postKeys.flatMap((k) => [k.key, k.posterKey]),
      ...profileKeys.map((k) => k.key),
      own?.avatarKey,
      own?.coverKey,
    ].filter((k): k is string => Boolean(k));
    return [...new Set(keys)];
  }

  private async recentPosts(authorId: string): Promise<AdminPostSummary[]> {
    const rows = await this.db
      .select({
        id: post.id,
        body: post.body,
        createdAt: post.createdAt,
        visibility: post.visibility,
        repostOfId: post.repostOfId,
      })
      .from(post)
      .where(and(eq(post.authorId, authorId), isNull(post.deletedAt)))
      .orderBy(desc(post.createdAt))
      .limit(POSTS_LIMIT);
    if (rows.length === 0) return [];
    const media = await this.db
      .select({
        postId: postMedia.postId,
        key: postMedia.key,
        kind: postMedia.kind,
        posterKey: postMedia.posterKey,
        position: postMedia.position,
      })
      .from(postMedia)
      .where(
        inArray(
          postMedia.postId,
          rows.map((r) => r.id),
        ),
      );
    return Promise.all(
      rows.map(async (r) => {
        const own = media.filter((m) => m.postId === r.id).sort((a, b) => a.position - b.position);
        const first = own[0];
        // Images have a medium copy; a video's poster is a single still.
        const thumbUrl = !first
          ? null
          : first.kind === "video"
            ? first.posterKey
              ? await this.storage.presignDownload(first.posterKey)
              : null
            : await this.storage.presignDownload(first.key, "md");
        return {
          id: r.id,
          body: r.body,
          createdAt: r.createdAt.toISOString(),
          visibility: r.visibility,
          isRepost: Boolean(r.repostOfId),
          mediaCount: own.length,
          thumbUrl,
        };
      }),
    );
  }

  private async log(
    actorId: string,
    action: string,
    subjectUserId: string | null,
    subjectPostId: string | null,
    detail: string | null,
  ) {
    await this.db.insert(moderationLog).values({ actorId, action, subjectUserId, subjectPostId, detail });
  }
}
