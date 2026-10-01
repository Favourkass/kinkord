import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, count, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { DRIZZLE, type Db } from "../db/db.module";
import {
  conversationParticipant,
  message,
  moderationLog,
  profile,
  report,
  user,
  type ReportEvidence,
  type ReportStatus,
} from "../db/schema";
import { PushService } from "../push/push.service";
import { StorageService } from "../storage/storage.service";
import { BlocksService } from "./blocks.service";
import { REPORT_REASONS, type AdminReportDto, type ReportInput, type ReportMemberDto } from "./dto";

/** Reports one member may make a day: room for a bad day, not for flooding the queue. */
export const REPORTS_PER_DAY = 10;
/** How much of the thread goes with a report: enough to judge it, not the whole history. */
export const EVIDENCE_MESSAGES = 20;
const LIST_LIMIT = 100;

/** Most serious reason first, then the rest in the order they're listed. */
const severity = sql`case ${report.reason} ${sql.join(
  REPORT_REASONS.map((r, i) => sql`when ${r} then ${sql.raw(String(i))}`),
  sql` `,
)} else ${sql.raw(String(REPORT_REASONS.length))} end`;

@Injectable()
export class ReportsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly storage: StorageService,
    private readonly blocks: BlocksService,
    private readonly push: PushService,
  ) {}

  /**
   * A member reports another, usually from a chat. The thread's last messages
   * go with the report as they stand now, so what a moderator reviews can't
   * change underneath them. Every moderator gets a push, and the reporter can
   * block in the same step.
   */
  async create(reporterId: string, input: ReportInput): Promise<{ id: string }> {
    const reportedId = input.userId;
    if (reportedId === reporterId) throw new BadRequestException("You can't report yourself.");
    const [target] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, reportedId))
      .limit(1);
    if (!target) throw new NotFoundException("Member not found.");

    const [today] = await this.db
      .select({ n: count() })
      .from(report)
      .where(
        and(eq(report.reporterId, reporterId), gt(report.createdAt, sql`now() - interval '1 day'`)),
      );
    if (Number(today?.n ?? 0) >= REPORTS_PER_DAY) {
      throw new HttpException(
        "You've sent a lot of reports today. Our team is on them; try again tomorrow.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const evidence = input.conversationId
      ? await this.evidence(input.conversationId, reporterId, reportedId)
      : [];
    const [created] = await this.db
      .insert(report)
      .values({
        reporterId,
        reportedUserId: reportedId,
        conversationId: input.conversationId ?? null,
        reason: input.reason,
        details: input.details?.length ? input.details : null,
        evidence,
      })
      .returning({ id: report.id });
    if (input.block) await this.blocks.block(reporterId, reportedId);
    this.push.newReport();
    return { id: created.id };
  }

  /**
   * Both members have to be in the thread: otherwise anyone could put a chat
   * they're not part of in front of the moderators by naming its id.
   */
  private async evidence(
    conversationId: string,
    reporterId: string,
    reportedId: string,
  ): Promise<ReportEvidence[]> {
    const members = await this.db
      .select({ userId: conversationParticipant.userId })
      .from(conversationParticipant)
      .where(
        and(
          eq(conversationParticipant.conversationId, conversationId),
          inArray(conversationParticipant.userId, [reporterId, reportedId]),
        ),
      );
    if (members.length < 2) throw new NotFoundException("Conversation not found.");
    const rows = await this.db
      .select()
      .from(message)
      .where(eq(message.conversationId, conversationId))
      .orderBy(desc(message.createdAt), desc(message.id))
      .limit(EVIDENCE_MESSAGES);
    return rows.reverse().map((m) => ({
      id: m.id,
      senderId: m.senderId,
      body: m.body,
      photoKey: m.photoKey,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  /** The moderators' queue. Open reports read most serious first, then newest. */
  async list(status: ReportStatus): Promise<AdminReportDto[]> {
    const reporter = alias(user, "reporter");
    const reported = alias(user, "reported");
    const reporterProfile = alias(profile, "reporter_profile");
    const reportedProfile = alias(profile, "reported_profile");
    const rows = await this.db
      .select({
        report,
        reporterId: reporter.id,
        reporterUsername: reporter.username,
        reporterName: reporter.name,
        reporterDisplayName: reporterProfile.displayName,
        reportedId: reported.id,
        reportedUsername: reported.username,
        reportedName: reported.name,
        reportedDisplayName: reportedProfile.displayName,
      })
      .from(report)
      .leftJoin(reporter, eq(reporter.id, report.reporterId))
      .leftJoin(reporterProfile, eq(reporterProfile.userId, report.reporterId))
      .leftJoin(reported, eq(reported.id, report.reportedUserId))
      .leftJoin(reportedProfile, eq(reportedProfile.userId, report.reportedUserId))
      .where(eq(report.status, status))
      .orderBy(...(status === "open" ? [severity] : []), desc(report.createdAt))
      .limit(LIST_LIMIT);

    const member = (
      id: string | null,
      username: string | null,
      name: string | null,
      displayName: string | null,
    ): ReportMemberDto | null =>
      id
        ? { userId: id, username, displayName: displayName ?? username ?? name ?? "Member" }
        : null;

    return Promise.all(
      rows.map(async (row) => {
        const r = row.report;
        return {
          id: r.id,
          reason: r.reason,
          details: r.details,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
          reviewedAt: r.reviewedAt?.toISOString() ?? null,
          reportedUserId: r.reportedUserId,
          reporter: member(
            row.reporterId,
            row.reporterUsername,
            row.reporterName,
            row.reporterDisplayName,
          ),
          reported: member(
            row.reportedId,
            row.reportedUsername,
            row.reportedName,
            row.reportedDisplayName,
          ),
          evidence: await Promise.all(
            r.evidence.map(async (m) => ({
              id: m.id,
              fromReported: m.senderId === r.reportedUserId,
              body: m.body ?? "",
              photo: m.photoKey
                ? {
                    thumbUrl: await this.storage.presignDownload(m.photoKey, "md"),
                    url: await this.storage.presignDownload(m.photoKey),
                  }
                : null,
              createdAt: m.createdAt,
            })),
          ),
        };
      }),
    );
  }

  /** Closes a report, recording who did and when, in the report and the moderation log. */
  async resolve(
    actorId: string,
    id: string,
    status: Exclude<ReportStatus, "open">,
  ): Promise<{ id: string; status: ReportStatus }> {
    const [updated] = await this.db
      .update(report)
      .set({ status, reviewedBy: actorId, reviewedAt: new Date() })
      .where(eq(report.id, id))
      .returning({ id: report.id, reportedUserId: report.reportedUserId });
    if (!updated) throw new NotFoundException("Report not found.");
    await this.db.insert(moderationLog).values({
      actorId,
      action: status === "resolved" ? "report_resolved" : "report_dismissed",
      subjectUserId: updated.reportedUserId,
      detail: id,
    });
    return { id, status };
  }
}
