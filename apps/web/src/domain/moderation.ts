/**
 * Admin moderation: what the API returns (PMs) and what the screens render
 * (VMs). Routing isn't known here, so the presenters pass the href builder in.
 */
import { shortDate, timeAgo } from "@/util/format";
import type { ReportReason } from "./safety";

export type BlockRuleKind = "email" | "phone" | "ip" | "name";
export type BlockRuleAction = "block" | "flag";

export interface AdminMemberPM {
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

export interface AdminPostPM {
  id: string;
  body: string | null;
  createdAt: string;
  visibility: string;
  isRepost: boolean;
  mediaCount: number;
  thumbUrl: string | null;
}

export interface BlockRulePM {
  id: string;
  kind: BlockRuleKind;
  value: string;
  action: BlockRuleAction;
  reason: string | null;
  subjectUserId: string | null;
  createdAt: string;
}

export interface AdminMemberDetailPM extends AdminMemberPM {
  ips: string[];
  verifiedPhones: string[];
  banReason: string | null;
  bannedAt: string | null;
  recentPosts: AdminPostPM[];
  rules: BlockRulePM[];
}

export interface NewBlockRulePM {
  kind: BlockRuleKind;
  value: string;
  action: BlockRuleAction;
  reason: string | null;
}

export type AdminBadge = "Blocked" | "Admin";

export interface AdminMemberRowVM {
  id: string;
  title: string;
  handle: string;
  email: string;
  meta: string;
  avatarUrl: string | null;
  initial: string;
  badges: AdminBadge[];
  href: string;
}

export interface AdminFactVM {
  label: string;
  value: string;
}

export interface AdminPostVM {
  id: string;
  text: string;
  meta: string;
  thumbUrl: string | null;
}

export interface BlockRuleVM {
  id: string;
  kind: string;
  value: string;
  action: string;
  flagged: boolean;
  note: string;
}

export interface AdminMemberDetailVM {
  id: string;
  title: string;
  handle: string;
  avatarUrl: string | null;
  initial: string;
  badges: AdminBadge[];
  facts: AdminFactVM[];
  banned: boolean;
  banNote: string | null;
  /** Admins can't be blocked or deleted from here; the API refuses too. */
  protectedAccount: boolean;
  postCount: number;
  posts: AdminPostVM[];
  rules: BlockRuleVM[];
  /** Typed to confirm deleting the account: the handle, or the email without one. */
  confirmPhrase: string;
}

const KIND_LABEL: Record<BlockRuleKind, string> = {
  email: "Email",
  phone: "Phone",
  ip: "IP address",
  name: "Name contains",
};

function titleOf(pm: AdminMemberPM): string {
  return pm.displayName?.trim() || pm.name;
}

function badgesOf(pm: AdminMemberPM): AdminBadge[] {
  const badges: AdminBadge[] = [];
  if (pm.banned) badges.push("Blocked");
  if (pm.admin) badges.push("Admin");
  return badges;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function toAdminMemberRowVM(
  pm: AdminMemberPM,
  href: (id: string) => string,
  now = new Date(),
): AdminMemberRowVM {
  const title = titleOf(pm);
  const seen = pm.lastSeenAt ? `seen ${timeAgo(pm.lastSeenAt, now)}` : "never seen";
  return {
    id: pm.id,
    title,
    handle: pm.username ? `@${pm.username}` : "no username",
    email: pm.email,
    meta: [`Joined ${shortDate(pm.createdAt)}`, plural(pm.posts, "post"), seen].join(" · "),
    avatarUrl: pm.avatarUrl,
    initial: title.charAt(0).toUpperCase() || "?",
    badges: badgesOf(pm),
    href: href(pm.id),
  };
}

export function toBlockRuleVM(pm: BlockRulePM, now = new Date()): BlockRuleVM {
  return {
    id: pm.id,
    kind: KIND_LABEL[pm.kind] ?? pm.kind,
    value: pm.value,
    action: pm.action === "block" ? "Blocked" : "Flagged for review",
    flagged: pm.action === "flag",
    note: [pm.reason, `added ${timeAgo(pm.createdAt, now)}`].filter(Boolean).join(" · "),
  };
}

function postText(pm: AdminPostPM): string {
  if (pm.body?.trim()) return pm.body.trim();
  if (pm.isRepost) return "Repost";
  return pm.mediaCount > 0 ? "Photo or video only" : "Empty post";
}

export function toAdminPostVM(pm: AdminPostPM, now = new Date()): AdminPostVM {
  const parts = [timeAgo(pm.createdAt, now), pm.visibility === "friends" ? "Friends" : "Public"];
  if (pm.mediaCount > 0) parts.push(plural(pm.mediaCount, "attachment"));
  if (pm.isRepost) parts.push("repost");
  return {
    id: pm.id,
    text: postText(pm),
    meta: parts.filter(Boolean).join(" · "),
    thumbUrl: pm.thumbUrl,
  };
}

export function toAdminMemberDetailVM(
  pm: AdminMemberDetailPM,
  now = new Date(),
): AdminMemberDetailVM {
  const title = titleOf(pm);
  const facts: AdminFactVM[] = [
    { label: "Email", value: pm.email },
    { label: "Phone", value: pm.phone ?? "None given" },
    {
      label: "Verified phones",
      value: pm.verifiedPhones.length ? pm.verifiedPhones.join(", ") : "None",
    },
    { label: "Joined", value: shortDate(pm.createdAt) ?? "Unknown" },
    {
      label: "Last seen",
      value: pm.lastSeenAt ? (timeAgo(pm.lastSeenAt, now) ?? "Unknown") : "Never",
    },
    { label: "Signed in from", value: pm.ips.length ? pm.ips.join(", ") : "No active sessions" },
  ];
  const banNote = pm.banned
    ? [`Blocked ${timeAgo(pm.bannedAt, now) ?? ""}`.trim(), pm.banReason]
        .filter(Boolean)
        .join(" · ")
    : null;
  return {
    id: pm.id,
    title,
    handle: pm.username ? `@${pm.username}` : "no username",
    avatarUrl: pm.avatarUrl,
    initial: title.charAt(0).toUpperCase() || "?",
    badges: badgesOf(pm),
    facts,
    banned: pm.banned,
    banNote,
    protectedAccount: pm.admin,
    postCount: pm.posts,
    posts: pm.recentPosts.map((p) => toAdminPostVM(p, now)),
    rules: pm.rules.map((r) => toBlockRuleVM(r, now)),
    confirmPhrase: pm.username ?? pm.email,
  };
}

/** Client-side check before the API sees it; the API validates again. */
export function validateNewRule(draft: NewBlockRulePM): string | null {
  const value = draft.value.trim();
  if (!value) return "Enter what to block.";
  if (draft.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return "That doesn't look like an email address.";
  }
  if (draft.kind === "phone" && value.replace(/\D/g, "").length < 8) {
    return "Enter the full phone number.";
  }
  if (draft.kind === "name" && value.replace(/[^a-zA-Z]/g, "").length < 4) {
    return "Use at least 4 letters, or it will catch too many people.";
  }
  return null;
}

export type AdminReportStatus = "open" | "resolved" | "dismissed";

export interface AdminReportMemberPM {
  userId: string;
  username: string | null;
  displayName: string;
}

export interface AdminReportEvidencePM {
  id: string;
  /** Written by the reported member, rather than by whoever reported them. */
  fromReported: boolean;
  body: string;
  photo: { thumbUrl: string; url: string } | null;
  createdAt: string;
}

export interface AdminReportPM {
  id: string;
  reason: ReportReason;
  details: string | null;
  status: AdminReportStatus;
  createdAt: string;
  reviewedAt: string | null;
  reportedUserId: string | null;
  /** Null once the account is gone; the report stays. */
  reporter: AdminReportMemberPM | null;
  reported: AdminReportMemberPM | null;
  evidence: AdminReportEvidencePM[];
}

export interface AdminReportEvidenceVM {
  id: string;
  fromReported: boolean;
  who: string;
  body: string;
  photo: { thumbUrl: string; url: string } | null;
  time: string;
}

export interface AdminReportVM {
  id: string;
  reason: string;
  /** Under 18, illegal, or shared without consent: act on these first. */
  urgent: boolean;
  when: string;
  reportedName: string;
  reportedHandle: string | null;
  /** The member's moderation page, where they can be blocked. */
  reportedHref: string | null;
  reporter: string;
  details: string | null;
  evidence: AdminReportEvidenceVM[];
  open: boolean;
}

const REASON_LABEL: Record<ReportReason, string> = {
  underage: "May be under 18",
  illegal: "Illegal content",
  non_consensual: "Intimate images shared without consent",
  unwanted_sexual: "Unwanted sexual messages or photos",
  harassment: "Harassment or threats",
  spam: "Spam or a scam",
  other: "Something else",
};

const URGENT: ReadonlySet<ReportReason> = new Set(["underage", "illegal", "non_consensual"]);

function memberLabel(m: AdminReportMemberPM | null, deleted: string): string {
  if (!m) return deleted;
  return m.username ? `${m.displayName} (@${m.username})` : m.displayName;
}

export function toAdminReportVM(
  pm: AdminReportPM,
  memberHref: (userId: string) => string,
  labels: { deletedAccount: string },
  now = new Date(),
): AdminReportVM {
  const reportedName =
    pm.reported?.displayName ??
    (pm.reportedUserId === null ? "Notification" : labels.deletedAccount);
  const reporterName = pm.reporter?.displayName ?? labels.deletedAccount;
  return {
    id: pm.id,
    reason: REASON_LABEL[pm.reason] ?? pm.reason,
    urgent: URGENT.has(pm.reason),
    when: timeAgo(pm.createdAt, now) ?? "",
    reportedName,
    reportedHandle: pm.reported?.username ? `@${pm.reported.username}` : null,
    reportedHref: pm.reportedUserId ? memberHref(pm.reportedUserId) : null,
    reporter: memberLabel(pm.reporter, labels.deletedAccount),
    details: pm.details?.trim() || null,
    evidence: pm.evidence.map((e) => ({
      id: e.id,
      fromReported: e.fromReported,
      who: e.fromReported ? reportedName : reporterName,
      body: e.body,
      photo: e.photo,
      time: timeAgo(e.createdAt, now) ?? "",
    })),
    open: pm.status === "open",
  };
}
