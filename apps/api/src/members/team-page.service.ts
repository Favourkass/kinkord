import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq, isNotNull, or, sql } from "drizzle-orm";
import { DRIZZLE, type Db } from "../db/db.module";
import { memberBan, moderationLog, profile, user } from "../db/schema";
import { isBanned, notBanned } from "../moderation/admins";
import { StorageService } from "../storage/storage.service";

/** Someone on Meet the Team, as anyone sees them, signed in or not. */
export interface TeamPageMember {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  title: string;
}

/** A Kinkord Team member on the admin page, shown on Meet the Team or not. */
export interface TeamPageAdminMember {
  id: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  /** Null: they have the Kinkord Team badge but no role, so the page leaves them out. */
  title: string | null;
  /** Blocked members are left off the page whatever their role. */
  blocked: boolean;
}

/** How the founders' "Software Engineer" is kept: trimmed, one line. */
export const TEAM_TITLE_MAX = 60;

/**
 * Meet the Team: the founders pick members and say what each does there.
 * Being on it is being on the Kinkord Team, so a role brings the Kinkord
 * Team badge and coming off the page takes it away.
 */
@Injectable()
export class TeamPageService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly storage: StorageService,
  ) {}

  /** Everyone with a role, first added first. */
  async list(): Promise<TeamPageMember[]> {
    const rows = await this.db
      .select({
        username: user.username,
        displayName: profile.displayName,
        avatarKey: profile.avatarKey,
        title: profile.teamTitle,
      })
      .from(profile)
      .innerJoin(user, eq(user.id, profile.userId))
      .where(
        and(
          eq(profile.teamMember, true),
          isNotNull(profile.teamTitle),
          isNotNull(user.username),
          notBanned(profile.userId),
        ),
      )
      .orderBy(asc(profile.teamTitleAt), asc(profile.userId));
    return Promise.all(
      rows.map(async (r) => ({
        username: r.username ?? "",
        displayName: r.displayName,
        avatarUrl: r.avatarKey ? await this.storage.presignDownload(r.avatarKey, "md") : null,
        title: r.title ?? "",
      })),
    );
  }

  /** The whole Kinkord Team for the admins: those on the page first, in its order. */
  async forAdmins(): Promise<TeamPageAdminMember[]> {
    const rows = await this.adminSelect()
      .where(or(eq(profile.teamMember, true), isNotNull(profile.teamTitle)))
      .orderBy(sql`${profile.teamTitleAt} asc nulls last`, asc(profile.displayName));
    return Promise.all(rows.map((r) => this.toAdminMember(r)));
  }

  /** Puts a member on the page with this role, or changes their role; they keep their place. */
  async setTitle(actorId: string, username: string, title: string): Promise<TeamPageAdminMember> {
    const handle = username.trim().replace(/^@/, "").toLowerCase();
    const [found] = await this.db
      .select({ id: user.id, hasProfile: profile.userId })
      .from(user)
      .leftJoin(profile, eq(profile.userId, user.id))
      .where(eq(user.username, handle))
      .limit(1);
    if (!found?.hasProfile) throw new NotFoundException(`No member has the username @${handle}.`);
    if (await isBanned(this.db, found.id)) {
      throw new ConflictException(`@${handle} is blocked. Unblock them first.`);
    }
    await this.db.transaction(async (tx) => {
      await tx
        .update(profile)
        .set({
          teamMember: true,
          teamTitle: title,
          teamTitleAt: sql`coalesce(${profile.teamTitleAt}, now())`,
        })
        .where(eq(profile.userId, found.id));
      await tx.insert(moderationLog).values({
        actorId,
        subjectUserId: found.id,
        action: "set-team-title",
        detail: title,
      });
    });
    const [row] = await this.adminSelect().where(eq(profile.userId, found.id)).limit(1);
    return this.toAdminMember(row);
  }

  /** Off the page and off the Kinkord Team: the role and the badge both go. */
  async remove(actorId: string, id: string): Promise<{ removed: string }> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(profile)
        .set({ teamMember: false, teamTitle: null, teamTitleAt: null })
        .where(
          and(
            eq(profile.userId, id),
            or(eq(profile.teamMember, true), isNotNull(profile.teamTitle)),
          ),
        )
        .returning({ id: profile.userId });
      if (!row) throw new NotFoundException("They aren't on the Kinkord Team.");
      await tx.insert(moderationLog).values({
        actorId,
        subjectUserId: id,
        action: "remove-team-member",
      });
      return { removed: id };
    });
  }

  private adminSelect() {
    return this.db
      .select({
        id: profile.userId,
        username: user.username,
        displayName: profile.displayName,
        avatarKey: profile.avatarKey,
        title: profile.teamTitle,
        blocked: sql<boolean>`exists (select 1 from ${memberBan} where ${memberBan.userId} = ${profile.userId})`,
      })
      .from(profile)
      .innerJoin(user, eq(user.id, profile.userId));
  }

  private async toAdminMember(
    r: Awaited<ReturnType<TeamPageService["adminSelect"]>>[number],
  ): Promise<TeamPageAdminMember> {
    return {
      id: r.id,
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarKey ? await this.storage.presignDownload(r.avatarKey, "sm") : null,
      title: r.title,
      blocked: r.blocked,
    };
  }
}
