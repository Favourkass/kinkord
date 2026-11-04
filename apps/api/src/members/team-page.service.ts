import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap,
} from "@nestjs/common";
import { and, asc, eq, isNotNull, not, or, sql } from "drizzle-orm";
import { DRIZZLE, type Db } from "../db/db.module";
import { memberBan, moderationLog, profile, user } from "../db/schema";
import {
  fixedTeamAccount,
  fixedTeamTitle,
  FIXED_TEAM_TITLES,
  isBanned,
  notBanned,
} from "../moderation/admins";
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

/** A fixed place sorts ahead of every member added on the admin page. */
const FIXED_PLACE = new Date(0);
const FIXED = "Their place on Meet the Team is fixed and can't be changed here.";

/**
 * Meet the Team: the founders pick members and say what each does there.
 * Being on it is being on the Kinkord Team, so a role brings the Kinkord
 * Team badge and coming off the page takes it away.
 */
@Injectable()
export class TeamPageService implements OnApplicationBootstrap {
  private readonly log = new Logger(TeamPageService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly storage: StorageService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.placeFixedTeam();
  }

  /**
   * Gives each account in FIXED_TEAM_TITLES its badge and role, first on the
   * page, whatever was done to it since. Never throws.
   */
  async placeFixedTeam(): Promise<void> {
    try {
      const accounts = await this.db
        .select({ id: user.id, email: user.email })
        .from(user)
        .where(fixedTeamAccount(user));
      for (const account of accounts) {
        const title = FIXED_TEAM_TITLES[account.email.trim().toLowerCase()];
        await this.db
          .update(profile)
          .set({ teamMember: true, teamTitle: title, teamTitleAt: FIXED_PLACE })
          .where(eq(profile.userId, account.id));
        this.log.log(`fixed team member ${account.id}: ${title}`);
      }
    } catch (e) {
      this.log.warn(`placing the fixed team members failed: ${String(e)}`);
    }
  }

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

  /**
   * The Kinkord Team for the admins: those on the page first, in its order.
   * Fixed places aren't listed, since nothing here can change them.
   */
  async forAdmins(): Promise<TeamPageAdminMember[]> {
    const rows = await this.adminSelect()
      .where(
        and(
          or(eq(profile.teamMember, true), isNotNull(profile.teamTitle)),
          not(fixedTeamAccount(user)),
        ),
      )
      .orderBy(sql`${profile.teamTitleAt} asc nulls last`, asc(profile.displayName));
    return Promise.all(rows.map((r) => this.toAdminMember(r)));
  }

  /** Puts a member on the page with this role, or changes their role; they keep their place. */
  async setTitle(actorId: string, username: string, title: string): Promise<TeamPageAdminMember> {
    const handle = username.trim().replace(/^@/, "").toLowerCase();
    const [found] = await this.db
      .select({
        id: user.id,
        hasProfile: profile.userId,
        email: user.email,
        emailVerified: user.emailVerified,
      })
      .from(user)
      .leftJoin(profile, eq(profile.userId, user.id))
      .where(eq(user.username, handle))
      .limit(1);
    if (!found?.hasProfile) throw new NotFoundException(`No member has the username @${handle}.`);
    if (fixedTeamTitle(found)) throw new ConflictException(FIXED);
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
    const [account] = await this.db
      .select({ email: user.email, emailVerified: user.emailVerified })
      .from(user)
      .where(eq(user.id, id))
      .limit(1);
    if (account && fixedTeamTitle(account)) throw new ConflictException(FIXED);
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
