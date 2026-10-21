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
  teamMember?: boolean;
  /** An organization's account, tied to `country`; absent from an older API. */
  organization?: boolean;
  country?: string | null;
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
  teamMember?: boolean;
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
    teamMember: Boolean(pm.teamMember),
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

/**
 * An admin's Silver: a founder's comes with their account, `given` is the
 * founders' gift to an admin, `paid` they bought themselves.
 */
export type AdminSilver = "founder" | "given" | "paid";

/** Someone with the admin tools. */
export interface AdminTeamMemberPM {
  id: string;
  name: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  /** An admin by their email, so they can't be removed. */
  founder: boolean;
  /** When they were made an admin; null for a founder. */
  since: string | null;
  /** Null on Basic. */
  silver: AdminSilver | null;
  /** When paid Silver runs out; null for any other kind. */
  silverUntil: string | null;
}

export interface AdminTeamPM {
  admins: AdminTeamMemberPM[];
  /** Only the founders add and remove admins. */
  canManage: boolean;
}

export interface AdminTeamRowVM {
  id: string;
  title: string;
  handle: string;
  avatarUrl: string | null;
  note: string;
  href: string;
  removable: boolean;
  /** Their Silver, in words; empty on Basic, and for a founder, whose Silver goes without saying. */
  silver: string;
  /** What a founder can do about their Silver here; null for anyone else, or for a founder's row. */
  silverAction: "give" | "remove" | null;
}

export function toAdminTeamRowVM(
  pm: AdminTeamMemberPM,
  opts: {
    canManage: boolean;
    href: (id: string) => string;
    labels: {
      founder: string;
      since: (date: string) => string;
      silverGiven: string;
      silverPaid: (date: string) => string;
    };
  },
): AdminTeamRowVM {
  const since = shortDate(pm.since);
  const paidUntil = pm.silver === "paid" ? shortDate(pm.silverUntil) : null;
  return {
    id: pm.id,
    title: pm.displayName?.trim() || pm.name,
    handle: pm.username ? `@${pm.username}` : "no username",
    avatarUrl: pm.avatarUrl,
    note: pm.founder ? opts.labels.founder : since ? opts.labels.since(since) : "",
    href: opts.href(pm.id),
    removable: opts.canManage && !pm.founder,
    silver:
      pm.silver === "given"
        ? opts.labels.silverGiven
        : paidUntil
          ? opts.labels.silverPaid(paidUntil)
          : "",
    silverAction: !opts.canManage || pm.founder ? null : pm.silver === "given" ? "remove" : "give",
  };
}

/** A username as typed ("@LadyJane ") the way it's stored: "ladyjane". */
export function adminUsername(input: string): string {
  return input.trim().replace(/^@/, "").toLowerCase();
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
  reportedUserId: string;
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
  reportedHref: string;
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
  const reportedName = pm.reported?.displayName ?? labels.deletedAccount;
  const reporterName = pm.reporter?.displayName ?? labels.deletedAccount;
  return {
    id: pm.id,
    reason: REASON_LABEL[pm.reason] ?? pm.reason,
    urgent: URGENT.has(pm.reason),
    when: timeAgo(pm.createdAt, now) ?? "",
    reportedName,
    reportedHandle: pm.reported?.username ? `@${pm.reported.username}` : null,
    reportedHref: memberHref(pm.reportedUserId),
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

// ---- Identity verification (Moderation → Verification) ----

export type AdminVerificationCheck =
  "governmentId" | "liveness" | "idFace" | "profileFace" | "dateOfBirth" | "gender" | "country";

export type AdminVerificationStatus =
  | "not_started"
  | "pending"
  | "failed"
  | "manual_review"
  | "verified"
  | "outdated"
  | "rejected"
  | "revoked";

/** Whether this admin may act on a verification: never their own, and an admin's only as a founder. */
interface AdminVerificationAccessPM {
  /** The viewing admin's own verification. */
  own: boolean;
  /** An admin's verification, and the viewer isn't a founder. */
  protected: boolean;
}

/** GET /admin/verification/reviews item. The photo links expire after 10 minutes. */
export interface AdminVerificationReviewPM extends AdminVerificationAccessPM {
  id: string;
  userId: string;
  username: string | null;
  displayName: string | null;
  reasonCodes: string[];
  createdAt: string;
  /** Look the session up in Didit's console to see the ID and selfie. */
  providerSessionId: string;
  checks: Partial<Record<AdminVerificationCheck, boolean>>;
  /** The photo as members see it, and the original it was made from. */
  photoUrl: string;
  originalPhotoUrl: string;
  /** Another account already holding this identity (with IDENTITY_ON_ANOTHER_ACCOUNT). */
  duplicateOf: { userId: string; username: string | null } | null;
}

/** GET /admin/verification/members/:id */
export interface AdminVerificationStatePM extends AdminVerificationAccessPM {
  status: AdminVerificationStatus;
  attemptsUsed: number;
}

/** Why this admin can't act on a verification, shown in place of the buttons. */
export interface AdminVerificationLockLabels {
  own: string;
  protected: string;
}

export interface AdminVerificationLabels extends AdminVerificationLockLabels {
  noName: string;
  checks: Record<AdminVerificationCheck, string>;
  reasons: Record<string, string>;
  /** "Same ID as @ada"; `handle` is null when that account has no username. */
  duplicateOf: (handle: string | null) => string;
  /** Why Approve is off: the ID checks failed. */
  idChecksFailed: string;
  /** Why Approve is off: the same identity is on another account (reject only). */
  identityElsewhere: string;
}

export interface AdminVerificationReviewVM {
  id: string;
  name: string;
  handle: string | null;
  memberHref: string;
  when: string;
  reasons: string[];
  checks: { key: AdminVerificationCheck; label: string; passed: boolean }[];
  photoUrl: string;
  originalPhotoUrl: string;
  sessionId: string;
  /** What only the ID proves has passed and the identity isn't on another account. */
  canApprove: boolean;
  /** Why Approve is off, when it is. */
  cannotApprove: string | null;
  /** Set when this admin may not decide it at all; shown instead of Approve and Reject. */
  locked: string | null;
  /** The account already verified with this ID, linking to its moderation page. */
  duplicate: { label: string; href: string } | null;
}

const CHECK_ORDER: AdminVerificationCheck[] = [
  "governmentId",
  "liveness",
  "idFace",
  "profileFace",
  "dateOfBirth",
  "gender",
  "country",
];

/** An admin can confirm the photo match and the country; the rest only the ID can prove. */
const ID_CHECKS: AdminVerificationCheck[] = [
  "governmentId",
  "liveness",
  "idFace",
  "dateOfBirth",
  "gender",
];

/**
 * Why a review can't be approved, if it can't: what only the ID proves failed,
 * or the same identity is on another account (one person, one verified
 * account: reject only, as the API enforces).
 */
function blockedApproval(
  pm: AdminVerificationReviewPM,
  labels: AdminVerificationLabels,
): string | null {
  if (!ID_CHECKS.every((key) => pm.checks[key] === true)) return labels.idChecksFailed;
  return pm.reasonCodes.includes("IDENTITY_ON_ANOTHER_ACCOUNT") ? labels.identityElsewhere : null;
}

/** Your own comes first: as a non-founder admin, your own verification is also an admin's. */
function lockedReason(
  pm: AdminVerificationAccessPM,
  labels: AdminVerificationLockLabels,
): string | null {
  if (pm.own) return labels.own;
  return pm.protected ? labels.protected : null;
}

export function toAdminVerificationReviewVM(
  pm: AdminVerificationReviewPM,
  memberHref: (userId: string) => string,
  labels: AdminVerificationLabels,
  now = new Date(),
): AdminVerificationReviewVM {
  const handle = pm.username ? `@${pm.username}` : null;
  const duplicate = pm.duplicateOf;
  return {
    id: pm.id,
    name: pm.displayName?.trim() || handle || labels.noName,
    handle,
    memberHref: memberHref(pm.userId),
    when: timeAgo(pm.createdAt, now) ?? "",
    reasons: pm.reasonCodes.map((code) => labels.reasons[code] ?? code),
    checks: CHECK_ORDER.map((key) => ({
      key,
      label: labels.checks[key],
      passed: pm.checks[key] === true,
    })),
    photoUrl: pm.photoUrl,
    originalPhotoUrl: pm.originalPhotoUrl,
    sessionId: pm.providerSessionId,
    canApprove: !blockedApproval(pm, labels),
    cannotApprove: blockedApproval(pm, labels),
    locked: lockedReason(pm, labels),
    duplicate: duplicate
      ? {
          label: labels.duplicateOf(duplicate.username ? `@${duplicate.username}` : null),
          href: memberHref(duplicate.userId),
        }
      : null,
  };
}

/**
 * Which verification actions an admin has on a member's page: revoke anything not
 * already revoked, and reopen once they're out of attempts or revoked. Neither on
 * your own, nor on an admin's unless you're a founder.
 */
export function adminVerificationActions(pm: AdminVerificationStatePM | null): {
  revoke: boolean;
  reopen: boolean;
} {
  if (!pm || pm.own || pm.protected) return { revoke: false, reopen: false };
  return {
    revoke: pm.status !== "revoked",
    reopen: pm.status === "rejected" || pm.status === "revoked",
  };
}

export interface AdminMemberVerificationLabels extends AdminVerificationLockLabels {
  statuses: Record<AdminVerificationStatus, string>;
  attemptsUsed: (n: number) => string;
}

/** A member's identity verification, on their moderation page. */
export interface AdminMemberVerificationVM {
  status: string;
  attempts: string;
  revoke: boolean;
  reopen: boolean;
  /** Why Revoke and Reopen are missing, shown in their place. */
  locked: string | null;
}

export function toAdminMemberVerificationVM(
  pm: AdminVerificationStatePM,
  labels: AdminMemberVerificationLabels,
): AdminMemberVerificationVM {
  return {
    status: labels.statuses[pm.status] ?? pm.status,
    attempts: labels.attemptsUsed(pm.attemptsUsed),
    ...adminVerificationActions(pm),
    locked: lockedReason(pm, labels),
  };
}

// What the API requires of a decision, revoke or reopen, checked first so the button says so.
const MIN_EVIDENCE = 3;
const MIN_REASON = 10;
const CODE_DIGITS = 6;

/** An authenticator code as typed or pasted: digits only, then six, so "123 456" stays whole. */
export function twoFactorCodeInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, CODE_DIGITS);
}

export function isTwoFactorCode(code: string): boolean {
  return code.length === CODE_DIGITS && /^\d+$/.test(code);
}

/** Approving or rejecting needs an evidence reference and a reason for the audit log. */
export function canDecideVerification(input: { evidence: string; reason: string }): boolean {
  return input.evidence.trim().length >= MIN_EVIDENCE && input.reason.trim().length >= MIN_REASON;
}

/** Revoking or reopening needs a reason for the log and a current authenticator code. */
export function canChangeVerification(input: { code: string; reason: string }): boolean {
  return isTwoFactorCode(input.code) && input.reason.trim().length >= MIN_REASON;
}

/** How long one admin 2FA confirmation lasts (POST /admin/verification/step-up). */
export const ADMIN_STEP_UP_MS = 10 * 60_000;

/**
 * How long this confirmation has left, from the API's `verifiedUntil`. A device clock
 * that disagrees with the server's can't make it lapse at once or run long: it's then
 * the full ten minutes, and the API's own STEP_UP_REQUIRED covers any difference.
 */
export function stepUpRemainingMs(verifiedUntil: string, now = Date.now()): number {
  const left = Date.parse(verifiedUntil) - now;
  return left > 0 && left <= ADMIN_STEP_UP_MS ? left : ADMIN_STEP_UP_MS;
}

/** A refusal about the admin's 2FA confirmation, told apart by the `code` the API sends. */
export type StepUpRefusal =
  /** 403: missing or expired, so ask for a new code. */
  | { kind: "required" }
  /** 403: a wrong code. */
  | { kind: "invalidCode" }
  /** 429: too many wrong codes, until `retryAt`. */
  | { kind: "locked"; retryAt: string | null }
  /** 403: this admin hasn't turned on two-factor. */
  | { kind: "twoFactorOff" };

export function stepUpRefusal(status: number, body: unknown): StepUpRefusal | null {
  const fields = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  if (status === 403 && fields.code === "STEP_UP_REQUIRED") return { kind: "required" };
  if (status === 403 && fields.code === "INVALID_CODE") return { kind: "invalidCode" };
  if (status === 403 && fields.code === "TWO_FACTOR_OFF") return { kind: "twoFactorOff" };
  if (status === 429 && fields.code === "STEP_UP_LOCKED")
    return { kind: "locked", retryAt: typeof fields.retryAt === "string" ? fields.retryAt : null };
  return null;
}

export interface StepUpMessageLabels {
  /** The confirmation ran out: enter a new code. */
  expired: string;
  /** "You can try again at 14:35." */
  retryAt: (time: string) => string;
}

/** What to tell the admin: the API's own words, plus when a lock lifts. */
export function stepUpMessage(
  refusal: StepUpRefusal,
  apiMessage: string,
  labels: StepUpMessageLabels,
): string {
  if (refusal.kind === "required") return labels.expired;
  if (refusal.kind === "locked") {
    const time = clockTime(refusal.retryAt);
    return time ? `${apiMessage} ${labels.retryAt(time)}` : apiMessage;
  }
  return apiMessage;
}

/** "14:35" on this device's clock; null when there's no time, or it isn't one. */
export function clockTime(at: string | number | null): string | null {
  if (at === null) return null;
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
