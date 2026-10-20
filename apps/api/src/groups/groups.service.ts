import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type AnyColumn,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { DRIZZLE, type Db } from "../db/db.module";
import {
  communityGroup,
  groupLog,
  groupMember,
  post,
  profile,
  user,
  POST_MEDIA_MAX,
  type GroupMemberStatus,
  type GroupPrivacy,
  type GroupRole,
} from "../db/schema";
import { teamBadge } from "../members/team-badge";
import { isAdmin, notBanned, type AdminCandidate } from "../moderation/admins";
import { PostsService, type FeedVM, type PostVM } from "../posts/posts.service";
import { containsPattern } from "../push/notifications.service";
import { PushService } from "../push/push.service";
import { StorageService } from "../storage/storage.service";
import { hasSilver, SILVER_POST_BODY_MAX, silverCheck } from "../subscriptions/plans";
import {
  GROUP_CATEGORIES,
  GROUP_DESCRIPTION_MAX,
  GROUP_DESCRIPTION_MIN,
  GROUP_NAME_MAX,
  GROUP_NAME_MIN,
  GROUP_RULES_MAX,
  GROUPS_PAGE_SIZE,
  MEMBERS_PAGE_SIZE,
  OFFICIAL_CATEGORY,
  THREAD_TITLE_MAX,
  THREAD_TITLE_MIN,
  THREADS_PER_DAY,
  slugCandidates,
  slugify,
  type GroupCategory,
} from "./group-options";
import {
  CREATE_REFUSALS,
  createRefusal,
  groupAccess,
  membershipOf,
  type CreateRefusal,
  type GroupAccess,
} from "./group-policy";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

export const createGroupSchema = z
  .object({
    name: z.string().trim().min(GROUP_NAME_MIN).max(GROUP_NAME_MAX),
    description: z.string().trim().min(GROUP_DESCRIPTION_MIN).max(GROUP_DESCRIPTION_MAX),
    rules: optionalText(GROUP_RULES_MAX),
    category: z.enum(GROUP_CATEGORIES),
    privacy: z.enum(["open", "closed"]).default("open"),
    /** ISO country code, as profiles store it. */
    country: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/)
      .nullish()
      .transform((v) => v?.toUpperCase() ?? null),
    state: optionalText(80),
  })
  .strict();
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

/** Everything but the privacy, which is chosen once (members joined on its terms). */
export const updateGroupSchema = createGroupSchema
  .omit({ privacy: true })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to change." });
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;

export const createThreadSchema = z
  .object({
    title: z.string().trim().min(THREAD_TITLE_MIN).max(THREAD_TITLE_MAX),
    // Silver's limit; Basic members' shorter one is checked where the plan is known.
    body: z.string().trim().min(1, "Write something first.").max(SILVER_POST_BODY_MAX),
    media: z
      .array(
        z.object({
          key: z.string().trim().min(1).max(500),
          kind: z.enum(["image", "video"]).default("image"),
        }),
      )
      .max(POST_MEDIA_MAX)
      .default([]),
  })
  .strict();
export type CreateThreadInput = z.infer<typeof createThreadSchema>;

export type GroupsView = "mine" | "near" | "popular" | "new";

export interface GroupSummaryVM {
  id: string;
  slug: string;
  name: string;
  /** Shortened for a list; the group page has it whole. */
  description: string;
  category: GroupCategory;
  privacy: GroupPrivacy;
  country: string | null;
  state: string | null;
  members: number;
  /** The viewer's place in it: null when they're not in it. */
  role: GroupRole | null;
  status: GroupMemberStatus | null;
}

export interface GroupPersonVM {
  userId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  role: GroupRole;
  silver: boolean;
  teamMember: boolean;
}

export interface GroupVM extends GroupSummaryVM {
  rules: string | null;
  createdAt: string;
  /** The owner first, then the moderators. */
  team: GroupPersonVM[];
  access: GroupAccess;
  /** Waiting for approval; moderators only. */
  requests: number | null;
}

export interface GroupMemberVM extends GroupPersonVM {
  status: GroupMemberStatus;
  /** When they joined, or asked to. */
  since: string;
}

export interface GroupsPageVM {
  items: GroupSummaryVM[];
  hasMore: boolean;
  /** Why "Near you" is empty: the viewer hasn't said where they are. */
  hint?: "no_location";
}

const SUMMARY_LENGTH = 240;

/** Active members of a group, counted where the group is read. */
function memberCount(groupId: AnyColumn): SQL<number> {
  return sql<number>`(select count(*)::int from ${groupMember} where ${groupMember.groupId} = ${groupId} and ${groupMember.status} = 'active')`;
}

/** The owner first, then moderators, then members. */
const ROLE_ORDER = sql`case ${groupMember.role} when 'owner' then 0 when 'moderator' then 1 else 2 end`;

const shorten = (text: string) =>
  text.length > SUMMARY_LENGTH ? `${text.slice(0, SUMMARY_LENGTH - 1).trimEnd()}…` : text;

const randomSuffix = () => randomBytes(2).toString("hex");

/**
 * Groups: FetLife-style forums around a place or an interest. Open groups
 * anyone joins and any member reads; closed ones a moderator lets people into,
 * and only members read. Discussions are posts with `groupId` set
 * (PostsService), and they never leave their group.
 */
@Injectable()
export class GroupsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly posts: PostsService,
    private readonly push: PushService,
    private readonly storage: StorageService,
  ) {}

  /** What the Groups screen needs before it shows "Create group". */
  async options(viewer: AdminCandidate) {
    const refusal = await this.createRefusalFor(viewer);
    const admin = await isAdmin(this.db, viewer);
    return {
      categories: GROUP_CATEGORIES.filter((c) => admin || c !== OFFICIAL_CATEGORY),
      canCreate: refusal === null,
      refusal,
      refusalMessage: refusal ? CREATE_REFUSALS[refusal] : null,
    };
  }

  async list(
    viewerId: string,
    params: { view?: GroupsView; q?: string; category?: GroupCategory; page?: number } = {},
  ): Promise<GroupsPageVM> {
    const view = params.view ?? "popular";
    const page = Math.max(1, params.page ?? 1);
    const mine = alias(groupMember, "viewer_membership");
    const members = memberCount(communityGroup.id);
    const conditions: (SQL | undefined)[] = [isNull(communityGroup.archivedAt)];
    if (params.q) {
      const pattern = containsPattern(params.q);
      conditions.push(
        or(ilike(communityGroup.name, pattern), ilike(communityGroup.description, pattern)),
      );
    }
    if (params.category) conditions.push(eq(communityGroup.category, params.category));
    if (view === "mine") conditions.push(isNotNull(mine.userId));
    if (view === "near") {
      const [me] = await this.db
        .select({ country: profile.country, state: profile.state })
        .from(profile)
        .where(eq(profile.userId, viewerId));
      if (!me?.state && !me?.country) return { items: [], hasMore: false, hint: "no_location" };
      conditions.push(
        me.state
          ? and(
              eq(communityGroup.state, me.state),
              ...(me.country ? [eq(communityGroup.country, me.country)] : []),
            )
          : eq(communityGroup.country, me.country as string),
      );
    }
    const order =
      view === "mine"
        ? [desc(mine.createdAt)]
        : view === "new"
          ? [desc(communityGroup.createdAt)]
          : [desc(members), desc(communityGroup.createdAt)];
    const rows = await this.db
      .select({
        id: communityGroup.id,
        slug: communityGroup.slug,
        name: communityGroup.name,
        description: communityGroup.description,
        category: communityGroup.category,
        privacy: communityGroup.privacy,
        country: communityGroup.country,
        state: communityGroup.state,
        members,
        role: mine.role,
        status: mine.status,
      })
      .from(communityGroup)
      .leftJoin(mine, and(eq(mine.groupId, communityGroup.id), eq(mine.userId, viewerId)))
      .where(and(...conditions))
      .orderBy(...order, asc(communityGroup.id))
      .limit(GROUPS_PAGE_SIZE + 1)
      .offset((page - 1) * GROUPS_PAGE_SIZE);
    return {
      items: rows.slice(0, GROUPS_PAGE_SIZE).map((r) => ({
        ...r,
        category: r.category as GroupCategory,
        description: shorten(r.description),
        members: Number(r.members),
      })),
      hasMore: rows.length > GROUPS_PAGE_SIZE,
    };
  }

  async create(viewer: AdminCandidate, input: CreateGroupInput): Promise<GroupVM> {
    const refusal = await this.createRefusalFor(viewer);
    if (refusal) {
      throw new ForbiddenException({
        message: CREATE_REFUSALS[refusal],
        code: `GROUP_CREATE_${refusal.toUpperCase()}`,
      });
    }
    await this.assertCategory(viewer, input.category);
    const slug = await this.freeSlug(slugify(input.name));
    try {
      await this.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(communityGroup)
          .values({
            slug,
            name: input.name,
            description: input.description,
            rules: input.rules,
            category: input.category,
            privacy: input.privacy,
            country: input.country,
            state: input.state,
            createdBy: viewer.id,
          })
          .returning({ id: communityGroup.id });
        await tx.insert(groupMember).values({
          groupId: row.id,
          userId: viewer.id,
          role: "owner",
          status: "active",
          joinedAt: new Date(),
        });
        await tx.insert(groupLog).values({ groupId: row.id, actorId: viewer.id, action: "create" });
      });
    } catch (e) {
      // Two groups named alike at the same moment: the address went to the other.
      if ((e as { code?: string }).code === "23505")
        throw new ConflictException("That name was just taken. Please try again.");
      throw e;
    }
    return this.detail(viewer.id, slug);
  }

  async detail(viewerId: string, slug: string): Promise<GroupVM> {
    const group = await this.live(slug);
    const membership = await membershipOf(this.db, group.id, viewerId);
    const access = groupAccess(group.privacy, membership);
    const [{ members }] = await this.db
      .select({ members: memberCount(communityGroup.id) })
      .from(communityGroup)
      .where(eq(communityGroup.id, group.id));
    const team = await this.people(
      group.id,
      [eq(groupMember.status, "active"), inArray(groupMember.role, ["owner", "moderator"])],
      50,
      0,
    );
    const requests = access.canModerate
      ? Number(
          (
            await this.db
              .select({ n: count() })
              .from(groupMember)
              .where(and(eq(groupMember.groupId, group.id), eq(groupMember.status, "pending")))
          )[0]?.n ?? 0,
        )
      : null;
    return {
      id: group.id,
      slug: group.slug,
      name: group.name,
      description: group.description,
      rules: group.rules,
      category: group.category as GroupCategory,
      privacy: group.privacy,
      country: group.country,
      state: group.state,
      createdAt: group.createdAt.toISOString(),
      members: Number(members),
      role: access.member ? (membership?.role ?? null) : null,
      status: membership?.status ?? null,
      team,
      access,
      requests,
    };
  }

  /** The owner or a moderator edits the group; only the owner renames it. */
  async update(viewer: AdminCandidate, slug: string, input: UpdateGroupInput): Promise<GroupVM> {
    const group = await this.live(slug);
    const access = await this.accessFor(group, viewer.id);
    if (!access.canModerate)
      throw new ForbiddenException("Only the group's moderators can edit it.");
    if (input.name !== undefined && !access.isOwner)
      throw new ForbiddenException("Only the owner can rename the group.");
    if (input.category) await this.assertCategory(viewer, input.category);
    await this.db
      .update(communityGroup)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(communityGroup.id, group.id));
    await this.log(group.id, viewer.id, "edit");
    return this.detail(viewer.id, slug);
  }

  /** The owner closes the group down. It's hidden, not erased: Kinkord can restore it. */
  async archive(viewerId: string, slug: string) {
    const group = await this.live(slug);
    if (!(await this.accessFor(group, viewerId)).isOwner)
      throw new ForbiddenException("Only the owner can close the group down.");
    await this.db
      .update(communityGroup)
      .set({ archivedAt: new Date() })
      .where(eq(communityGroup.id, group.id));
    await this.log(group.id, viewerId, "close-group");
    return { archived: slug };
  }

  /** Open: in at once. Closed: a request the moderators hear about. Joining twice changes nothing. */
  async join(viewerId: string, slug: string) {
    const group = await this.live(slug);
    const existing = await membershipOf(this.db, group.id, viewerId);
    if (existing) return { status: existing.status, role: existing.role };
    const status: GroupMemberStatus = group.privacy === "open" ? "active" : "pending";
    const added = await this.db
      .insert(groupMember)
      .values({
        groupId: group.id,
        userId: viewerId,
        role: "member",
        status,
        joinedAt: status === "active" ? new Date() : null,
      })
      .onConflictDoNothing()
      .returning({ userId: groupMember.userId });
    if (added.length && status === "pending") {
      for (const id of await this.moderatorIds(group.id))
        this.push.groupRequest(viewerId, id, group.slug);
    }
    return { status, role: "member" as const };
  }

  /** Leave, or take back a request. The owner can't walk away from the group. */
  async leave(viewerId: string, slug: string) {
    const group = await this.live(slug);
    const membership = await membershipOf(this.db, group.id, viewerId);
    if (membership?.role === "owner")
      throw new BadRequestException(
        "You own this group. Close it down instead, or ask Kinkord to hand it to someone.",
      );
    await this.db
      .delete(groupMember)
      .where(and(eq(groupMember.groupId, group.id), eq(groupMember.userId, viewerId)));
    return { status: null, role: null };
  }

  /** Members to anyone who may read the group; requests to its moderators. */
  async members(
    viewerId: string,
    slug: string,
    params: { status?: GroupMemberStatus; page?: number } = {},
  ) {
    const group = await this.live(slug);
    const access = await this.accessFor(group, viewerId);
    const status = params.status ?? "active";
    if (status === "pending" ? !access.canModerate : !access.canRead)
      throw new ForbiddenException(
        status === "pending"
          ? "Only the group's moderators see requests."
          : "Join the group to see who's in it.",
      );
    const page = Math.max(1, params.page ?? 1);
    const rows = await this.people(
      group.id,
      [eq(groupMember.status, status)],
      MEMBERS_PAGE_SIZE + 1,
      (page - 1) * MEMBERS_PAGE_SIZE,
      // Requests in the order they came; members by role, newest first.
      status === "pending" ? [asc(groupMember.createdAt)] : undefined,
    );
    return { items: rows.slice(0, MEMBERS_PAGE_SIZE), hasMore: rows.length > MEMBERS_PAGE_SIZE };
  }

  async approve(viewerId: string, slug: string, userId: string) {
    const group = await this.live(slug);
    await this.assertModerator(group, viewerId);
    const [row] = await this.db
      .update(groupMember)
      .set({ status: "active", joinedAt: new Date() })
      .where(
        and(
          eq(groupMember.groupId, group.id),
          eq(groupMember.userId, userId),
          eq(groupMember.status, "pending"),
        ),
      )
      .returning({ userId: groupMember.userId });
    if (!row) throw new NotFoundException("That request isn't waiting any more.");
    await this.log(group.id, viewerId, "approve", userId);
    this.push.groupApproved(viewerId, userId, group.slug);
    return { status: "active" as const };
  }

  /**
   * Decline a request, or remove a member. Nobody removes the owner, and only
   * the owner removes a moderator.
   */
  async removeMember(viewerId: string, slug: string, userId: string) {
    const group = await this.live(slug);
    const access = await this.assertModerator(group, viewerId);
    const target = await membershipOf(this.db, group.id, userId);
    if (!target) throw new NotFoundException("They aren't in this group.");
    if (target.role === "owner") throw new ForbiddenException("The owner can't be removed.");
    if (target.role === "moderator" && !access.isOwner)
      throw new ForbiddenException("Only the owner can remove a moderator.");
    await this.db
      .delete(groupMember)
      .where(and(eq(groupMember.groupId, group.id), eq(groupMember.userId, userId)));
    await this.log(
      group.id,
      viewerId,
      target.status === "pending" ? "decline" : "remove-member",
      userId,
    );
    return { removed: userId };
  }

  /** The owner makes a member a moderator, or a moderator a member again. */
  async setRole(viewerId: string, slug: string, userId: string, role: "moderator" | "member") {
    const group = await this.live(slug);
    if (!(await this.accessFor(group, viewerId)).isOwner)
      throw new ForbiddenException("Only the owner chooses the moderators.");
    const target = await membershipOf(this.db, group.id, userId);
    if (!target || target.status !== "active")
      throw new NotFoundException("They aren't a member of this group.");
    if (target.role === "owner") throw new BadRequestException("The owner stays the owner.");
    if (target.role !== role) {
      await this.db
        .update(groupMember)
        .set({ role })
        .where(and(eq(groupMember.groupId, group.id), eq(groupMember.userId, userId)));
      await this.log(
        group.id,
        viewerId,
        role === "moderator" ? "add-moderator" : "remove-moderator",
        userId,
      );
    }
    return { role };
  }

  async threads(viewerId: string, slug: string, cursor?: string | null): Promise<FeedVM> {
    const group = await this.live(slug);
    const access = await this.accessFor(group, viewerId);
    if (!access.canRead) throw new ForbiddenException("Join the group to read its discussions.");
    return this.posts.groupThreads(viewerId, group.id, { cursor, moderator: access.canModerate });
  }

  async createThread(viewerId: string, slug: string, input: CreateThreadInput): Promise<PostVM> {
    const group = await this.live(slug);
    if (!(await this.accessFor(group, viewerId)).canPost)
      throw new ForbiddenException("Join the group to start a discussion.");
    const [{ n }] = await this.db
      .select({ n: count() })
      .from(post)
      .where(
        and(
          eq(post.authorId, viewerId),
          isNotNull(post.groupId),
          gt(post.createdAt, new Date(Date.now() - 864e5)),
        ),
      );
    if (Number(n) >= THREADS_PER_DAY)
      throw new HttpException(
        `You can start ${THREADS_PER_DAY} discussions a day. Please try again tomorrow.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    return this.posts.create(
      viewerId,
      { body: input.body, media: input.media, visibility: "public" },
      { groupId: group.id, title: input.title },
    );
  }

  async thread(viewerId: string, slug: string, postId: string) {
    const group = await this.live(slug);
    const access = await this.accessFor(group, viewerId);
    if (!access.canRead) throw new ForbiddenException("Join the group to read its discussions.");
    const thread = await this.posts.byId(postId, viewerId, { groups: true });
    if (!thread || thread.group?.id !== group.id)
      throw new NotFoundException("Discussion not found.");
    return { group: await this.detail(viewerId, slug), thread };
  }

  async setPinned(viewerId: string, slug: string, postId: string, pinned: boolean) {
    return this.moderateThread(viewerId, slug, postId, pinned ? "pin" : "unpin", {
      pinnedAt: pinned ? new Date() : null,
    });
  }

  async setClosed(viewerId: string, slug: string, postId: string, closed: boolean) {
    return this.moderateThread(viewerId, slug, postId, closed ? "close" : "reopen", {
      closedAt: closed ? new Date() : null,
    });
  }

  /** Its author takes a discussion down; a moderator removes it (and that's logged). */
  async removeThread(viewerId: string, slug: string, postId: string) {
    const group = await this.live(slug);
    const thread = await this.groupPost(group.id, postId);
    if (thread.authorId === viewerId) return this.posts.remove(postId, viewerId);
    await this.assertModerator(group, viewerId);
    await this.posts.removeAsModerator(postId);
    await this.log(group.id, viewerId, "remove-discussion", thread.authorId, postId);
    return { deleted: postId };
  }

  /** Every group, closed down ones too, for Kinkord's admins. */
  async adminList(params: { status?: "all" | "live" | "archived"; q?: string; page?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const owner = alias(groupMember, "owner_membership");
    const ownerUser = alias(user, "owner_user");
    const conditions: (SQL | undefined)[] = [
      params.status === "live"
        ? isNull(communityGroup.archivedAt)
        : params.status === "archived"
          ? isNotNull(communityGroup.archivedAt)
          : undefined,
      params.q
        ? or(
            ilike(communityGroup.name, containsPattern(params.q)),
            ilike(communityGroup.slug, containsPattern(params.q)),
          )
        : undefined,
    ];
    const rows = await this.db
      .select({
        id: communityGroup.id,
        slug: communityGroup.slug,
        name: communityGroup.name,
        category: communityGroup.category,
        privacy: communityGroup.privacy,
        createdAt: communityGroup.createdAt,
        archivedAt: communityGroup.archivedAt,
        members: memberCount(communityGroup.id),
        ownerId: owner.userId,
        ownerUsername: ownerUser.username,
      })
      .from(communityGroup)
      .leftJoin(owner, and(eq(owner.groupId, communityGroup.id), eq(owner.role, "owner")))
      .leftJoin(ownerUser, eq(ownerUser.id, owner.userId))
      .where(and(...conditions))
      .orderBy(desc(communityGroup.createdAt), asc(communityGroup.id))
      .limit(GROUPS_PAGE_SIZE + 1)
      .offset((page - 1) * GROUPS_PAGE_SIZE);
    return {
      items: rows.slice(0, GROUPS_PAGE_SIZE).map((r) => ({
        ...r,
        members: Number(r.members),
        createdAt: r.createdAt.toISOString(),
        archivedAt: r.archivedAt?.toISOString() ?? null,
      })),
      hasMore: rows.length > GROUPS_PAGE_SIZE,
    };
  }

  /** Kinkord closes a group down, or brings it back. */
  async adminArchive(actorId: string, groupId: string, archived: boolean) {
    const [row] = await this.db
      .update(communityGroup)
      .set({ archivedAt: archived ? new Date() : null })
      .where(eq(communityGroup.id, groupId))
      .returning({ id: communityGroup.id });
    if (!row) throw new NotFoundException("Group not found.");
    await this.log(groupId, actorId, archived ? "admin-close-group" : "admin-restore-group");
    return { id: groupId, archived };
  }

  private async moderateThread(
    viewerId: string,
    slug: string,
    postId: string,
    action: string,
    change: { pinnedAt?: Date | null; closedAt?: Date | null },
  ) {
    const group = await this.live(slug);
    await this.assertModerator(group, viewerId);
    const thread = await this.groupPost(group.id, postId);
    await this.db.update(post).set(change).where(eq(post.id, postId));
    await this.log(group.id, viewerId, action, thread.authorId, postId);
    return {
      id: postId,
      ...("pinnedAt" in change ? { pinned: change.pinnedAt !== null } : {}),
      ...("closedAt" in change ? { closed: change.closedAt !== null } : {}),
    };
  }

  /** A live discussion in this group, or a 404. */
  private async groupPost(groupId: string, postId: string) {
    const [row] = await this.db
      .select({ authorId: post.authorId })
      .from(post)
      .where(and(eq(post.id, postId), eq(post.groupId, groupId), isNull(post.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundException("Discussion not found.");
    return row;
  }

  private async people(
    groupId: string,
    where: SQL[],
    limit: number,
    offset: number,
    order?: SQL[],
  ): Promise<GroupMemberVM[]> {
    const rows = await this.db
      .select({
        userId: groupMember.userId,
        role: groupMember.role,
        status: groupMember.status,
        createdAt: groupMember.createdAt,
        joinedAt: groupMember.joinedAt,
        username: user.username,
        displayName: profile.displayName,
        avatarKey: profile.avatarKey,
        silver: silverCheck(groupMember.userId),
        teamMember: teamBadge(groupMember.userId),
      })
      .from(groupMember)
      .innerJoin(user, eq(user.id, groupMember.userId))
      .leftJoin(profile, eq(profile.userId, groupMember.userId))
      .where(and(eq(groupMember.groupId, groupId), notBanned(groupMember.userId), ...where))
      .orderBy(...(order ?? [ROLE_ORDER, desc(groupMember.joinedAt), asc(groupMember.userId)]))
      .limit(limit)
      .offset(offset);
    return Promise.all(
      rows.map(async (r) => ({
        userId: r.userId,
        username: r.username,
        displayName: r.displayName ?? r.username ?? "Member",
        avatarUrl: r.avatarKey ? await this.storage.presignDownload(r.avatarKey, "sm") : null,
        role: r.role,
        status: r.status,
        silver: Boolean(r.silver),
        teamMember: Boolean(r.teamMember),
        since: (r.joinedAt ?? r.createdAt).toISOString(),
      })),
    );
  }

  /** A live group by its address. A closed-down one reads as gone. */
  private async live(slug: string) {
    const [row] = await this.db
      .select()
      .from(communityGroup)
      .where(and(eq(communityGroup.slug, slug), isNull(communityGroup.archivedAt)))
      .limit(1);
    if (!row) throw new NotFoundException("Group not found.");
    return row;
  }

  private async accessFor(group: { id: string; privacy: GroupPrivacy }, viewerId: string) {
    return groupAccess(group.privacy, await membershipOf(this.db, group.id, viewerId));
  }

  private async assertModerator(group: { id: string; privacy: GroupPrivacy }, viewerId: string) {
    const access = await this.accessFor(group, viewerId);
    if (!access.canModerate)
      throw new ForbiddenException("Only the group's moderators can do that.");
    return access;
  }

  private async moderatorIds(groupId: string): Promise<string[]> {
    const rows = await this.db
      .select({ userId: groupMember.userId })
      .from(groupMember)
      .where(
        and(
          eq(groupMember.groupId, groupId),
          eq(groupMember.status, "active"),
          inArray(groupMember.role, ["owner", "moderator"]),
        ),
      );
    return rows.map((r) => r.userId);
  }

  private async createRefusalFor(viewer: AdminCandidate): Promise<CreateRefusal | null> {
    const [account] = await this.db
      .select({ createdAt: user.createdAt })
      .from(user)
      .where(eq(user.id, viewer.id))
      .limit(1);
    const [{ owned }] = await this.db
      .select({ owned: count() })
      .from(groupMember)
      .innerJoin(communityGroup, eq(communityGroup.id, groupMember.groupId))
      .where(
        and(
          eq(groupMember.userId, viewer.id),
          eq(groupMember.role, "owner"),
          isNull(communityGroup.archivedAt),
        ),
      );
    return createRefusal({
      silver: await hasSilver(this.db, viewer.id),
      admin: await isAdmin(this.db, viewer),
      accountCreatedAt: account?.createdAt ?? new Date(),
      owned: Number(owned),
    });
  }

  private async assertCategory(viewer: AdminCandidate, category: GroupCategory) {
    if (category === OFFICIAL_CATEGORY && !(await isAdmin(this.db, viewer)))
      throw new ForbiddenException("Only Kinkord files a group as official.");
  }

  /** The plain address if it's free, else the first free variation of it. */
  private async freeSlug(base: string): Promise<string> {
    const candidates = slugCandidates(base, randomSuffix);
    const taken = await this.db
      .select({ slug: communityGroup.slug })
      .from(communityGroup)
      .where(inArray(communityGroup.slug, candidates));
    const used = new Set(taken.map((r) => r.slug));
    return candidates.find((c) => !used.has(c)) ?? `${base.slice(0, 40)}-${randomSuffix()}`;
  }

  private async log(
    groupId: string,
    actorId: string,
    action: string,
    subjectUserId?: string,
    subjectPostId?: string,
  ) {
    await this.db
      .insert(groupLog)
      .values({ groupId, actorId, action, subjectUserId, subjectPostId });
  }
}
