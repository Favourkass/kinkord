import { describe, expect, it } from "vitest";
import {
  ADMIN_STEP_UP_MS,
  adminVerificationActions,
  adminUsername,
  canChangeVerification,
  canDecideVerification,
  clockTime,
  isTwoFactorCode,
  stepUpMessage,
  stepUpRefusal,
  stepUpRemainingMs,
  toAdminMemberVerificationVM,
  toAdminTeamRowVM,
  toAdminReportVM,
  toAdminVerificationReviewVM,
  twoFactorCodeInput,
  type AdminVerificationReviewPM,
  type AdminVerificationStatePM,
  type AdminReportPM,
  toAdminMemberDetailVM,
  toAdminMemberRowVM,
  toAdminPostVM,
  toBlockRuleVM,
  validateNewRule,
  type AdminMemberDetailPM,
  type AdminMemberPM,
  type AdminTeamMemberPM,
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
    own: false,
    protected: false,
    duplicateOf: null,
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
    own: "Your own",
    protected: "Founders only",
    duplicateOf: (handle: string | null) => `Same ID as ${handle ?? "another account"}`,
    idChecksFailed: "ID checks failed: reject only",
    identityElsewhere: "On another account: reject only",
  };
  const href = (id: string) => `/moderation/members/${id}`;

  it("labels reasons and checks, and allows approval when the ID itself passed", () => {
    const vm = toAdminVerificationReviewVM(review, href, labels, now);
    expect(vm).toMatchObject({
      name: "Ada",
      handle: "@ada",
      memberHref: "/moderation/members/u2",
      when: "an hour ago",
      reasons: ["Unclear photo match", "SOMETHING_NEW"],
      sessionId: "session-1",
      canApprove: true,
      locked: null,
      duplicate: null,
    });
    expect(vm.checks.filter((check) => !check.passed).map((check) => check.key)).toEqual([
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
    expect(vm.cannotApprove).toBe("ID checks failed: reject only");
  });

  it("only allows rejecting an identity that's already on another account", () => {
    const vm = toAdminVerificationReviewVM(
      { ...review, reasonCodes: ["IDENTITY_ON_ANOTHER_ACCOUNT"] },
      href,
      labels,
      now,
    );
    expect(vm).toMatchObject({
      canApprove: false,
      cannotApprove: "On another account: reject only",
    });
    // Didit's similar-name or same-face matches are for the admin to judge.
    expect(
      toAdminVerificationReviewVM(
        { ...review, reasonCodes: ["POSSIBLE_DUPLICATE_AT_DIDIT", "FACE_ON_ANOTHER_ACCOUNT"] },
        href,
        labels,
        now,
      ).canApprove,
    ).toBe(true);
  });

  it("locks the decision on your own review, and on an admin's unless you're a founder", () => {
    expect(toAdminVerificationReviewVM({ ...review, own: true }, href, labels, now).locked).toBe(
      "Your own",
    );
    expect(
      toAdminVerificationReviewVM({ ...review, protected: true }, href, labels, now).locked,
    ).toBe("Founders only");
    // A non-founder admin's own review is both; "your own" is the reason that applies.
    expect(
      toAdminVerificationReviewVM({ ...review, own: true, protected: true }, href, labels, now)
        .locked,
    ).toBe("Your own");
  });

  it("names the account already verified with this ID and links to it", () => {
    const vm = toAdminVerificationReviewVM(
      { ...review, duplicateOf: { userId: "u7", username: "twin" } },
      href,
      labels,
      now,
    );
    expect(vm.duplicate).toEqual({ label: "Same ID as @twin", href: "/moderation/members/u7" });
    expect(
      toAdminVerificationReviewVM(
        { ...review, duplicateOf: { userId: "u8", username: null } },
        href,
        labels,
        now,
      ).duplicate,
    ).toEqual({ label: "Same ID as another account", href: "/moderation/members/u8" });
  });
});

describe("adminVerificationActions", () => {
  const state = (over: Partial<AdminVerificationStatePM>): AdminVerificationStatePM => ({
    status: "verified",
    attemptsUsed: 0,
    own: false,
    protected: false,
    ...over,
  });

  it("revokes anything not already revoked, and reopens once out of attempts or revoked", () => {
    expect(adminVerificationActions(state({}))).toEqual({ revoke: true, reopen: false });
    expect(adminVerificationActions(state({ status: "revoked" }))).toEqual({
      revoke: false,
      reopen: true,
    });
    expect(adminVerificationActions(state({ status: "rejected", attemptsUsed: 3 }))).toEqual({
      revoke: true,
      reopen: true,
    });
    expect(adminVerificationActions(state({ status: "not_started" }))).toEqual({
      revoke: true,
      reopen: false,
    });
    expect(adminVerificationActions(null)).toEqual({ revoke: false, reopen: false });
  });

  it("offers nothing on your own verification, or an admin's to a non-founder", () => {
    const none = { revoke: false, reopen: false };
    expect(adminVerificationActions(state({ status: "rejected", own: true }))).toEqual(none);
    expect(adminVerificationActions(state({ status: "rejected", protected: true }))).toEqual(none);
  });
});

describe("toAdminMemberVerificationVM", () => {
  const labels = {
    statuses: {
      not_started: "Not verified",
      pending: "Checking",
      failed: "Didn't pass",
      manual_review: "Waiting for review",
      verified: "Verified",
      outdated: "Lapsed",
      rejected: "Out of attempts",
      revoked: "Revoked",
    },
    attemptsUsed: (n: number) => `${n} of 3 attempts used`,
    own: "Your own",
    protected: "Founders only",
  };
  const pm: AdminVerificationStatePM = {
    status: "rejected",
    attemptsUsed: 3,
    own: false,
    protected: false,
  };

  it("labels the status and attempts, with the actions on offer", () => {
    expect(toAdminMemberVerificationVM(pm, labels)).toEqual({
      status: "Out of attempts",
      attempts: "3 of 3 attempts used",
      revoke: true,
      reopen: true,
      locked: null,
    });
  });

  it("says why the actions are missing on your own or a protected verification", () => {
    expect(toAdminMemberVerificationVM({ ...pm, own: true }, labels)).toMatchObject({
      revoke: false,
      reopen: false,
      locked: "Your own",
    });
    expect(toAdminMemberVerificationVM({ ...pm, protected: true }, labels)).toMatchObject({
      revoke: false,
      reopen: false,
      locked: "Founders only",
    });
  });
});

describe("verification inputs", () => {
  it("keeps the digits of a typed or pasted code before limiting it to six", () => {
    expect(twoFactorCodeInput("123 456")).toBe("123456");
    expect(twoFactorCodeInput("12ab3456")).toBe("123456");
    expect(twoFactorCodeInput("Code: 987-654-3")).toBe("987654");
    expect(isTwoFactorCode("123456")).toBe(true);
    expect(isTwoFactorCode("12345")).toBe(false);
    expect(isTwoFactorCode("12345a")).toBe(false);
  });

  it("needs evidence and a reason of at least ten characters for a decision", () => {
    expect(canDecideVerification({ evidence: "didit:s1", reason: "Same person." })).toBe(true);
    expect(canDecideVerification({ evidence: " ab ", reason: "Same person." })).toBe(false);
    expect(canDecideVerification({ evidence: "didit:s1", reason: "  too short  " })).toBe(false);
  });

  it("needs a six-digit code and a reason to revoke or reopen", () => {
    expect(canChangeVerification({ code: "123456", reason: "Confirmed fraud." })).toBe(true);
    expect(canChangeVerification({ code: "12345", reason: "Confirmed fraud." })).toBe(false);
    expect(canChangeVerification({ code: "123456", reason: "short" })).toBe(false);
  });
});

describe("admin 2FA step-up", () => {
  const labels = {
    expired: "Enter a new code.",
    retryAt: (time: string) => `Try again at ${time}.`,
  };

  it("tells the refusals apart by the code the API sends", () => {
    expect(stepUpRefusal(403, { code: "STEP_UP_REQUIRED", message: "x" })).toEqual({
      kind: "required",
    });
    expect(stepUpRefusal(403, { code: "INVALID_CODE" })).toEqual({ kind: "invalidCode" });
    expect(stepUpRefusal(403, { code: "TWO_FACTOR_OFF" })).toEqual({ kind: "twoFactorOff" });
    expect(stepUpRefusal(429, { code: "STEP_UP_LOCKED", retryAt: "2026-10-13T10:15:00Z" })).toEqual(
      { kind: "locked", retryAt: "2026-10-13T10:15:00Z" },
    );
    expect(stepUpRefusal(429, { code: "STEP_UP_LOCKED" })).toEqual({
      kind: "locked",
      retryAt: null,
    });
    expect(stepUpRefusal(403, { message: "You can't decide your own verification." })).toBeNull();
    expect(stepUpRefusal(409, { code: "STEP_UP_REQUIRED" })).toBeNull();
    expect(stepUpRefusal(403, "Forbidden")).toBeNull();
  });

  it("uses the API's words, adds when a lock lifts, and asks for a new code once expired", () => {
    const retryAt = "2026-10-13T10:15:00Z";
    expect(stepUpMessage({ kind: "invalidCode" }, "Wrong code.", labels)).toBe("Wrong code.");
    expect(stepUpMessage({ kind: "twoFactorOff" }, "Turn on 2FA.", labels)).toBe("Turn on 2FA.");
    expect(stepUpMessage({ kind: "locked", retryAt }, "Too many wrong codes.", labels)).toBe(
      `Too many wrong codes. Try again at ${clockTime(retryAt)}.`,
    );
    expect(clockTime(retryAt)).toMatch(/^\d{2}:\d{2}$/);
    expect(stepUpMessage({ kind: "locked", retryAt: null }, "Locked.", labels)).toBe("Locked.");
    expect(stepUpMessage({ kind: "required" }, "Confirm a code.", labels)).toBe(
      "Enter a new code.",
    );
  });

  it("times the confirmation from verifiedUntil, falling back to ten minutes on a skewed clock", () => {
    const at = Date.parse("2026-10-13T10:00:00Z");
    expect(stepUpRemainingMs("2026-10-13T10:09:00Z", at)).toBe(9 * 60_000);
    // This device's clock runs ahead of the server's, or behind it, or the time is broken.
    expect(stepUpRemainingMs("2026-10-13T09:59:00Z", at)).toBe(ADMIN_STEP_UP_MS);
    expect(stepUpRemainingMs("2026-10-13T10:30:00Z", at)).toBe(ADMIN_STEP_UP_MS);
    expect(stepUpRemainingMs("not a time", at)).toBe(ADMIN_STEP_UP_MS);
    expect(clockTime("not a time")).toBeNull();
    expect(clockTime(null)).toBeNull();
  });
});

describe("toAdminTeamRowVM", () => {
  const labels = {
    founder: "Founder",
    since: (d: string) => `Admin since ${d}`,
    silverGiven: "Silver, from the founders",
    silverPaid: (d: string) => `Silver until ${d}`,
  };
  const href = (id: string) => `/moderation/members/${id}`;
  const jane: AdminTeamMemberPM = {
    id: "u7",
    name: "Jane Doe",
    displayName: "  ",
    username: "ladyjane",
    avatarUrl: null,
    founder: false,
    since: "2026-10-10T09:00:00.000Z",
    silver: null,
    silverUntil: null,
  };

  it("says since when, and is removable only by someone who manages admins", () => {
    expect(toAdminTeamRowVM(jane, { canManage: true, href, labels })).toEqual({
      id: "u7",
      title: "Jane Doe",
      handle: "@ladyjane",
      avatarUrl: null,
      note: "Admin since 10 Oct 2026",
      href: "/moderation/members/u7",
      removable: true,
      silver: "",
      silverAction: "give",
    });
    expect(toAdminTeamRowVM(jane, { canManage: false, href, labels })).toMatchObject({
      removable: false,
      silverAction: null,
    });
  });

  it("never offers to remove a founder, or to change their Silver", () => {
    const founder = {
      ...jane,
      founder: true,
      since: null,
      username: null,
      silver: "founder" as const,
    };
    expect(toAdminTeamRowVM(founder, { canManage: true, href, labels })).toMatchObject({
      handle: "no username",
      note: "Founder",
      removable: false,
      silver: "",
      silverAction: null,
    });
  });

  it("says whose Silver it is, and offers to take back only what the founders gave", () => {
    const given = { ...jane, silver: "given" as const };
    expect(toAdminTeamRowVM(given, { canManage: true, href, labels })).toMatchObject({
      silver: "Silver, from the founders",
      silverAction: "remove",
    });
    const paid = { ...jane, silver: "paid" as const, silverUntil: "2026-11-06T12:00:00.000Z" };
    expect(toAdminTeamRowVM(paid, { canManage: true, href, labels })).toMatchObject({
      silver: "Silver until 6 Nov 2026",
      silverAction: "give",
    });
  });
});

describe("adminUsername", () => {
  it("reads a username however it was typed", () => {
    expect(adminUsername("  @LadyJane ")).toBe("ladyjane");
    expect(adminUsername("@")).toBe("");
  });
});
