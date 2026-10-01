/**
 * Reporting and blocking another member. The copy for each reason lives in
 * constants/chat.ts; the moderators' labels in domain/moderation.ts.
 */

/** Most serious first, matching the API and the order the moderators read in. */
export const REPORT_REASONS = [
  "underage",
  "illegal",
  "non_consensual",
  "unwanted_sexual",
  "harassment",
  "spam",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

/** Mirrors the API's limit, so the field stops where the server would refuse. */
export const REPORT_DETAILS_MAX = 1000;

/** A report being written. Blocking in the same step is on unless the member turns it off. */
export interface ReportDraft {
  reason: ReportReason | null;
  details: string;
  block: boolean;
}

export const EMPTY_REPORT: ReportDraft = { reason: null, details: "", block: true };

/** What the report call sends. */
export interface ReportInputPM {
  userId: string;
  conversationId?: string;
  reason: ReportReason;
  details?: string;
  block: boolean;
}

/** A draft can be sent once it has a reason; the details are optional. */
export function toReportInput(
  draft: ReportDraft,
  userId: string,
  conversationId?: string,
): ReportInputPM | null {
  if (!draft.reason) return null;
  const details = draft.details.trim().slice(0, REPORT_DETAILS_MAX);
  return {
    userId,
    ...(conversationId ? { conversationId } : {}),
    reason: draft.reason,
    ...(details ? { details } : {}),
    block: draft.block,
  };
}
