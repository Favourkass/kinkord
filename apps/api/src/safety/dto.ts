import { z } from "zod";
import type { ReportReason, ReportStatus } from "../db/schema";

/** Most serious first: the order the moderators' queue reads in. */
export const REPORT_REASONS = [
  "underage",
  "illegal",
  "non_consensual",
  "unwanted_sexual",
  "harassment",
  "spam",
  "other",
] as const satisfies readonly ReportReason[];

export const REPORT_DETAILS_MAX = 1000;

const memberId = z.string().trim().min(1).max(64);

export const blockSchema = z.object({ userId: memberId });

export const reportSchema = z.object({
  userId: memberId,
  /** The chat it came from: the thread's last messages go with the report. */
  conversationId: z.string().uuid().optional(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(REPORT_DETAILS_MAX).optional(),
  /** Block them in the same step. */
  block: z.boolean().default(false),
});

export type ReportInput = z.infer<typeof reportSchema>;

export const reportQuerySchema = z.object({
  status: z.enum(["open", "resolved", "dismissed"]).default("open"),
});

export const resolveReportSchema = z.object({ status: z.enum(["resolved", "dismissed"]) });

export interface ReportMemberDto {
  userId: string;
  username: string | null;
  displayName: string;
}

export interface ReportEvidenceDto {
  id: string;
  /** Written by the member who was reported, rather than by the reporter. */
  fromReported: boolean;
  body: string;
  photo: { thumbUrl: string; url: string } | null;
  createdAt: string;
}

export interface AdminReportDto {
  id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  createdAt: string;
  reviewedAt: string | null;
  reportedUserId: string;
  /** Null once the account is gone; the report stays. */
  reporter: ReportMemberDto | null;
  reported: ReportMemberDto | null;
  evidence: ReportEvidenceDto[];
}
