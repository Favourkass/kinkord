/**
 * Admin moderation API. Every call is refused by the server for non-admins, so
 * nothing here is a security boundary; it only shapes requests.
 */
import type {
  AdminMemberDetailPM,
  AdminMemberPM,
  AdminReportPM,
  AdminReportStatus,
  AdminVerificationReviewPM,
  AdminVerificationStatePM,
  AdminVerificationStatus,
  BlockRulePM,
  NewBlockRulePM,
} from "@/domain/moderation";
import { api } from "./apiClient";

const member = (id: string) => `/admin/members/${encodeURIComponent(id)}`;
const verificationOf = (id: string) => `/admin/verification/members/${encodeURIComponent(id)}`;

export const moderationService = {
  access: () => api.get<{ isAdmin: boolean }>("/admin/access"),

  search: (query: string) =>
    api.get<AdminMemberPM[]>(`/admin/members?q=${encodeURIComponent(query.trim())}`),

  member: (id: string) => api.get<AdminMemberDetailPM>(member(id)),

  block: (id: string, opts: { reason: string | null; deletePosts: boolean }) =>
    api.post<{ blocked: string; postsRemoved: number }>(`${member(id)}/block`, opts),

  unblock: (id: string) => api.post<{ unblocked: string }>(`${member(id)}/unblock`, {}),

  deleteMember: (id: string, opts: { block: boolean; reason: string | null }) => {
    const params = new URLSearchParams({ block: opts.block ? "1" : "0" });
    if (opts.reason?.trim()) params.set("reason", opts.reason.trim());
    return api.del<{ deleted: string }>(`${member(id)}?${params.toString()}`);
  },

  deleteMemberPosts: (id: string) => api.del<{ postsRemoved: number }>(`${member(id)}/posts`),

  deletePost: (postId: string) =>
    api.del<{ deleted: string }>(`/admin/posts/${encodeURIComponent(postId)}`),

  /** Members' reports, most serious first. */
  reports: (status: AdminReportStatus = "open") =>
    api.get<AdminReportPM[]>(`/admin/reports?status=${encodeURIComponent(status)}`),

  resolveReport: (id: string, status: Exclude<AdminReportStatus, "open">) =>
    api.post<{ id: string; status: AdminReportStatus }>(
      `/admin/reports/${encodeURIComponent(id)}/resolve`,
      { status },
    ),

  /** Identity checks waiting for an admin, oldest first. Needs 2FA on the admin's account. */
  verificationReviews: () => api.get<AdminVerificationReviewPM[]>("/admin/verification/reviews"),

  decideVerification: (
    id: string,
    body: { decision: "approve" | "reject"; evidenceReference: string; reason: string },
  ) =>
    api.post<{ status: AdminVerificationStatus }>(
      `/admin/verification/reviews/${encodeURIComponent(id)}/decision`,
      body,
    ),

  memberVerification: (id: string) => api.get<AdminVerificationStatePM>(verificationOf(id)),

  revokeVerification: (id: string) =>
    api.post<{ status: AdminVerificationStatus }>(`${verificationOf(id)}/revoke`, {}),

  reopenVerification: (id: string) =>
    api.post<{ status: AdminVerificationStatus }>(`${verificationOf(id)}/reopen`, {}),

  rules: () => api.get<BlockRulePM[]>("/admin/blocklist"),

  addRule: (rule: NewBlockRulePM) => api.post<BlockRulePM>("/admin/blocklist", rule),

  removeRule: (id: string) =>
    api.del<{ removed: string }>(`/admin/blocklist/${encodeURIComponent(id)}`),
};
