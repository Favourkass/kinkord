import { describe, expect, it } from "vitest";
import {
  adminVerificationActions,
  toAdminReportVM,
  toAdminVerificationReviewVM,
  type AdminReportPM,
  type AdminVerificationReviewPM,
  toAdminMemberDetailVM,
  toAdminMemberRowVM,
  toAdminPostVM,
  toBlockRuleVM,
  validateNewRule,
  type AdminMemberDetailPM,
  type AdminMemberPM,
} from "./moderation";

const now = new Date("2026-09-28T09:00:00Z");

const pm: AdminMemberPM = {
  id: "u9",
  name: "Durowara Tolulope Charles",
  displayName: "Tolu",
  username: "downtoearth",
  email: "ctolulope05@gmail.com",
  phone: "+2349054291043",
  avatarUrl: null,
  createdAt: "2026-09-04T16:24:27.065Z",
  lastSeenAt: null,
  posts: 1,
  banned: true,
  admin: false,
};

describe("toAdminMemberRowVM", () => {
  it("leads with the display name and says what an admin needs at a glance", () => {
    const vm = toAdminMemberRowVM(pm, (id) => `/moderation/members/${id}`, now);
    expect(vm).toMatchObject({
      title: "Tolu",
      handle: "@downtoearth",
      meta: "Joined 4 Sept 2026 · 1 post · never seen",
      initial: "T",
      badges: ["Blocked"],
      href: "/moderation/members/u9",
    });
  });

  it("falls back to the account name and marks a missing handle", () => {
    const vm = toAdminMemberRowVM(
      { ...pm, displayName: null, username: null, posts: 2 },
      (id) => id,
      now,
    );
    expect(vm.title).toBe("Durowara Tolulope Charles");
    expect(vm.handle).toBe("no username");
    expect(vm.meta).toContain("2 posts");
  });
});

describe("toAdminMemberDetailVM", () => {
  const detail: AdminMemberDetailPM = {
    ...pm,
    admin: false,
    ips: ["102.89.84.23"],
    verifiedPhones: [],
    banReason: "harassment",
    bannedAt: "2026-09-28T08:00:00Z",
    recentPosts: [],
    rules: [],
  };

  it("lists the facts used to judge the account", () => {
    const vm = toAdminMemberDetailVM(detail, now);
    expect(vm.facts.map((f) => f.label)).toEqual([
      "Email",
      "Phone",
      "Verified phones",
      "Joined",
      "Last seen",
      "Signed in from",
    ]);
    expect(vm.facts.find((f) => f.label === "Signed in from")?.value).toBe("102.89.84.23");
    expect(vm.banNote).toBe("Blocked an hour ago · harassment");
    expect(vm.confirmPhrase).toBe("downtoearth");
  });

  it("protects admin accounts and asks for the email when there is no handle", () => {
    const vm = toAdminMemberDetailVM(
      { ...detail, admin: true, username: null, banned: false },
      now,
    );
    expect(vm.protectedAccount).toBe(true);
    expect(vm.banNote).toBeNull();
    expect(vm.confirmPhrase).toBe("ctolulope05@gmail.com");
  });
});

describe("toAdminPostVM", () => {
  it("describes a photo-only friends post", () => {
    const vm = toAdminPostVM(
      {
        id: "p1",
        body: null,
        createdAt: "2026-09-28T08:59:00Z",
        visibility: "friends",
        isRepost: false,
        mediaCount: 2,
        thumbUrl: "https://media/x",
      },
      now,
    );
    expect(vm.text).toBe("Photo or video only");
    expect(vm.meta).toBe("a minute ago · Friends · 2 attachments");
  });
});

describe("toBlockRuleVM", () => {
  it("labels the kind and whether it refuses or only flags", () => {
    const vm = toBlockRuleVM(
      {
        id: "r1",
        kind: "name",
        value: "durowara",
        action: "flag",
        reason: "Removed 2026-09-28",
        subjectUserId: null,
        createdAt: "2026-09-28T08:00:00Z",
      },
      now,
    );
    expect(vm).toMatchObject({
      kind: "Name contains",
      action: "Flagged for review",
      flagged: true,
    });
    expect(vm.note).toBe("Removed 2026-09-28 · added an hour ago");
  });
});

describe("validateNewRule", () => {
  const base = { kind: "email" as const, value: "", action: "block" as const, reason: null };
  it("needs a value, and one that fits the kind", () => {
    expect(validateNewRule(base)).toBe("Enter what to block.");
    expect(validateNewRule({ ...base, value: "not-an-email" })).toMatch(/email/);
    expect(validateNewRule({ ...base, kind: "phone", value: "0803" })).toMatch(/phone/);
    expect(validateNewRule({ ...base, kind: "name", value: "Tol" })).toMatch(/4 letters/);
    expect(validateNewRule({ ...base, value: "ctolulope05@gmail.com" })).toBeNull();
  });
});

describe("toAdminReportVM", () => {
  const report: AdminReportPM = {
    id: "r1",
    reason: "underage",
    details: "  says they're 16  ",
    status: "open",
    createdAt: "2026-09-28T08:00:00Z",
    reviewedAt: null,
    reportedUserId: "u2",
    reporter: { userId: "u1", username: "favour", displayName: "Favour" },
    reported: { userId: "u2", username: "ada", displayName: "Ada" },
    evidence: [
      {
        id: "m1",
        fromReported: true,
        body: "",
        photo: { thumbUrl: "https://m/p_md.jpg", url: "https://m/p.jpg" },
        createdAt: "2026-09-28T07:58:00Z",
      },
      {
        id: "m2",
        fromReported: false,
        body: "how old are you?",
        photo: null,
        createdAt: "2026-09-28T07:59:00Z",
      },
    ],
  };
  const href = (id: string) => `/moderation/members/${id}`;

  it("flags the urgent reasons and links to the reported member", () => {
    const vm = toAdminReportVM(report, href, { deletedAccount: "a deleted account" }, now);
    expect(vm).toMatchObject({
      reason: "May be under 18",
      urgent: true,
      when: "an hour ago",
      reportedName: "Ada",
      reportedHandle: "@ada",
      reportedHref: "/moderation/members/u2",
      reporter: "Favour (@favour)",
      details: "says they're 16",
      open: true,
    });
    expect(vm.evidence.map((e) => [e.who, e.fromReported, Boolean(e.photo)])).toEqual([
      ["Ada", true, true],
      ["Favour", false, false],
    ]);
  });

  it("keeps a report whose accounts are gone, and doesn't call spam urgent", () => {
    const vm = toAdminReportVM(
      {
        ...report,
        reason: "spam",
        reporter: null,
        reported: null,
        status: "dismissed",
        details: " ",
      },
      href,
      { deletedAccount: "a deleted account" },
      now,
    );
    expect(vm).toMatchObject({
      urgent: false,
      reportedName: "a deleted account",
      reportedHandle: null,
      reportedHref: "/moderation/members/u2",
      reporter: "a deleted account",
      details: null,
      open: false,
    });
  });
});

describe("toAdminVerificationReviewVM", () => {
  const review: AdminVerificationReviewPM = {
    id: "v1",
    userId: "u2",
    username: "ada",
    displayName: " Ada ",
    reasonCodes: ["PROFILE_PHOTO_MATCH_INCONCLUSIVE", "SOMETHING_NEW"],
    createdAt: "2026-09-28T08:00:00Z",
    providerSessionId: "session-1",
    checks: {
      governmentId: true,
      liveness: true,
      idFace: true,
      profileFace: false,
      dateOfBirth: true,
      gender: true,
      country: false,
    },
    photoUrl: "https://m/a_md.jpg",
    originalPhotoUrl: "https://m/a.jpg",
  };
  const labels = {
    noName: "Unnamed member",
    checks: {
      governmentId: "Government ID",
      liveness: "Live selfie",
      idFace: "Selfie matches ID",
      profileFace: "Selfie matches profile photo",
      dateOfBirth: "Birth date",
      gender: "Gender",
      country: "Country",
    },
    reasons: { PROFILE_PHOTO_MATCH_INCONCLUSIVE: "Unclear photo match" },
  };
  const href = (id: string) => `/moderation/members/${id}`;

  it("labels the reasons and checks, and allows approval when the ID itself passed", () => {
    const vm = toAdminVerificationReviewVM(review, href, labels, now);
    expect(vm).toMatchObject({
      name: "Ada",
      handle: "@ada",
      memberHref: "/moderation/members/u2",
      when: "an hour ago",
      reasons: ["Unclear photo match", "SOMETHING_NEW"],
      sessionId: "session-1",
      canApprove: true,
    });
    expect(vm.checks.filter((c) => !c.passed).map((c) => c.key)).toEqual([
      "profileFace",
      "country",
    ]);
  });

  it("only allows rejecting when something only the ID can prove failed", () => {
    const vm = toAdminVerificationReviewVM(
      {
        ...review,
        displayName: null,
        username: null,
        checks: { ...review.checks, liveness: false },
      },
      href,
      labels,
      now,
    );
    expect(vm.name).toBe("Unnamed member");
    expect(vm.canApprove).toBe(false);
  });
});

describe("adminVerificationActions", () => {
  it("offers revoking a live verification and reopening a closed one", () => {
    expect(adminVerificationActions({ status: "verified", attemptsUsed: 0 })).toEqual({
      revoke: true,
      reopen: false,
    });
    expect(adminVerificationActions({ status: "revoked", attemptsUsed: 0 })).toEqual({
      revoke: false,
      reopen: true,
    });
    expect(adminVerificationActions({ status: "rejected", attemptsUsed: 3 })).toEqual({
      revoke: true,
      reopen: true,
    });
    expect(adminVerificationActions({ status: "not_started", attemptsUsed: 0 })).toEqual({
      revoke: false,
      reopen: false,
    });
    expect(adminVerificationActions(null)).toEqual({ revoke: false, reopen: false });
  });
});
