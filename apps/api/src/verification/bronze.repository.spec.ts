import { describe, expect, it, vi } from "vitest";
import type { Db } from "../db/db.module";
import {
  bronzeAttempt,
  bronzeConsent,
  bronzeReview,
  bronzeVerification,
  verificationErasure,
  verificationIdentityHold,
} from "../db/schema";
import { BronzeRepository } from "./bronze.repository";

/**
 * A stand-in for the Drizzle client: every builder call returns the chain and
 * each `await` takes the next queued answer, so a spec lists the database's
 * replies in order and then checks what was written. Transactions run inline.
 */
function queuedDb(answers: unknown[]) {
  const queue = [...answers];
  const calls: Array<{ op: string; args: unknown[] }> = [];
  const chain = (): unknown =>
    new Proxy(() => undefined, {
      get(_target, prop) {
        if (prop === "then") {
          const value = queue.shift();
          return (resolve: (v: unknown) => void) => resolve(value);
        }
        if (prop === "transaction") return (fn: (tx: unknown) => unknown) => fn(chain());
        return (...args: unknown[]) => {
          calls.push({ op: String(prop), args });
          return chain();
        };
      },
    });
  /** What `set` received after `update` was called on `table`. */
  const setOn = (table: unknown) => {
    const at = calls.findIndex((c) => c.op === "update" && c.args[0] === table);
    return at < 0 ? undefined : calls.slice(at + 1).find((c) => c.op === "set")?.args[0];
  };
  const valuesOn = (table: unknown) => {
    const at = calls.findIndex((c) => c.op === "insert" && c.args[0] === table);
    return at < 0 ? undefined : calls.slice(at + 1).find((c) => c.op === "values")?.args[0];
  };
  return { repo: new BronzeRepository(chain() as Db), calls, setOn, valuesOn };
}

const passedChecks = {
  governmentId: true,
  liveness: true,
  idFace: true,
  profileFace: false,
  dateOfBirth: true,
  gender: true,
  country: false,
};

describe("BronzeRepository", () => {
  it("returns null when no profile identity exists", async () => {
    const where = vi.fn(async () => []);
    const from = vi.fn(() => ({ where }));
    const db = { select: vi.fn(() => ({ from })) } as unknown as Db;
    const repository = new BronzeRepository(db);

    await expect(repository.snapshot("user-1")).resolves.toBeNull();
    expect(where).toHaveBeenCalledOnce();
  });

  describe("revoke", () => {
    it("ends anything still in flight, so no later result or approval restores it", async () => {
      const { repo, setOn } = queuedDb([
        [{ userId: "u1" }],
        [{ userId: "u1" }],
        undefined,
        undefined,
        [],
      ]);
      await expect(repo.revoke("u1")).resolves.toBe(true);
      expect(setOn(bronzeVerification)).toMatchObject({
        status: "revoked",
        currentAttemptId: null,
        verifiedAvatarKey: null,
      });
      expect(setOn(bronzeAttempt)).toMatchObject({
        status: "failed",
        failureCodes: ["VERIFICATION_REVOKED"],
      });
      expect(setOn(bronzeReview)).toMatchObject({ status: "withdrawn" });
    });

    it("reports nothing to revoke for a member who never started", async () => {
      const { repo, setOn } = queuedDb([[]]);
      await expect(repo.revoke("u1")).resolves.toBe(false);
      expect(setOn(bronzeAttempt)).toBeUndefined();
    });
  });

  describe("start reservation", () => {
    const snapshot = {
      avatarKey: "avatars/u1/a.jpg",
      dob: "1998-04-02",
      gender: "female",
      country: "NG",
      nationality: null,
    };

    it("reserves locally before a paid provider session is created", async () => {
      const { repo, valuesOn } = queuedDb([
        undefined,
        [{ status: "not_started", attemptsUsed: 0 }],
        [{ id: "consent-1" }],
        [{ number: 0 }],
        undefined,
        undefined,
      ]);
      const reservation = await repo.reserve("u1", snapshot);
      expect(reservation).toEqual({
        attemptId: expect.any(String),
        reservationJobId: expect.stringMatching(/^reservation:/),
      });
      expect(valuesOn(bronzeAttempt)).toMatchObject({
        userId: "u1",
        providerJobId: reservation?.reservationJobId,
      });
    });

    it("does not reserve once consent was withdrawn, checked under the same lock", async () => {
      const { repo, valuesOn } = queuedDb([
        undefined,
        [{ status: "not_started", attemptsUsed: 0 }],
        [],
      ]);
      await expect(repo.reserve("u1", snapshot)).resolves.toBeNull();
      expect(valuesOn(bronzeAttempt)).toBeUndefined();
    });

    it("does not reserve a second session while one is pending", async () => {
      const { repo, valuesOn } = queuedDb([undefined, [{ status: "pending", attemptsUsed: 1 }]]);
      await expect(repo.reserve("u1", snapshot)).resolves.toBeNull();
      expect(valuesOn(bronzeAttempt)).toBeUndefined();
    });
  });

  describe("withdrawConsent", () => {
    const withdraw = (state: { status: string; attemptsUsed: number }) =>
      queuedDb([
        undefined,
        [state],
        [{ jobId: "didit:session-1" }, { jobId: "reservation:local-only" }],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ]);

    it("queues provider erasure durably and ends the badge", async () => {
      const { repo, setOn, valuesOn, calls } = withdraw({ status: "verified", attemptsUsed: 0 });
      await expect(repo.withdrawConsent("u1")).resolves.toEqual(["session-1"]);
      expect(valuesOn(verificationErasure)).toEqual([{ providerSessionId: "session-1" }]);
      expect(setOn(bronzeVerification)).toMatchObject({
        status: "not_started",
        currentAttemptId: null,
        verifiedAvatarKey: null,
      });
      expect(calls.some((c) => c.op === "for" && c.args[0] === "update")).toBe(true);
    });

    it("keeps the attempts already used, so withdrawing never buys more", async () => {
      const { repo, setOn } = withdraw({ status: "failed", attemptsUsed: 2 });
      await repo.withdrawConsent("u1");
      expect(setOn(bronzeVerification)).not.toHaveProperty("attemptsUsed");
      expect(setOn(bronzeVerification)).toMatchObject({ status: "not_started" });
    });

    it("leaves a member out of attempts, or revoked, for an admin to reopen", async () => {
      for (const [state, expected] of [
        [{ status: "rejected", attemptsUsed: 3 }, "rejected"],
        [{ status: "pending", attemptsUsed: 3 }, "rejected"],
        [{ status: "revoked", attemptsUsed: 0 }, "revoked"],
      ] as const) {
        const { repo, setOn } = withdraw(state);
        await repo.withdrawConsent("u1");
        expect(setOn(bronzeVerification)).toMatchObject({ status: expected });
      }
    });
  });

  it("closes the door on a start still attaching before listing sessions to erase", async () => {
    const { repo, calls, setOn, valuesOn } = queuedDb([
      undefined,
      [{ userId: "u1" }],
      undefined,
      undefined,
      undefined,
      [{ jobId: "didit:session-1" }],
      undefined,
    ]);
    await expect(repo.queueErasuresForUser("u1")).resolves.toEqual(["session-1"]);
    const locked = calls.findIndex((c) => c.op === "for");
    const listed = calls.findIndex(
      (c, i) => i > locked && c.op === "from" && c.args[0] === bronzeAttempt,
    );
    expect(locked).toBeGreaterThan(-1);
    expect(listed).toBeGreaterThan(locked);
    expect(setOn(bronzeVerification)).toEqual({ currentAttemptId: null });
    // No standing consent, so no new start can reserve before the account goes.
    expect(setOn(bronzeConsent)).toEqual({ withdrawnAt: expect.any(Date) });
    expect(valuesOn(verificationErasure)).toEqual([{ providerSessionId: "session-1" }]);
  });

  describe("identity holds", () => {
    it("keeps a revoked member's fingerprints apart from their account", async () => {
      const { repo, valuesOn } = queuedDb([
        [{ userId: "u1" }],
        [{ userId: "u1" }],
        undefined,
        undefined,
        [{ binding: "fp-1" }, { binding: "fp-1" }, { binding: "fp-2" }],
        undefined,
      ]);
      await expect(repo.revoke("u1")).resolves.toBe(true);
      expect(valuesOn(verificationIdentityHold)).toEqual([
        { binding: "fp-1", userId: "u1" },
        { binding: "fp-2", userId: "u1" },
      ]);
    });

    it("counts a hold on another account as the identity being used elsewhere", async () => {
      const { repo, calls } = queuedDb([[], [{ binding: "fp-1" }]]);
      await expect(repo.bindingUsedElsewhere("fp-1", "u2")).resolves.toBe(true);
      expect(calls.filter((c) => c.op === "from").map((c) => c.args[0])).toEqual([
        bronzeAttempt,
        verificationIdentityHold,
      ]);
    });
  });

  describe("reservations and expiry", () => {
    it("removes a stale reservation the member has moved past, giving nothing back", async () => {
      const { repo, calls, setOn } = queuedDb([
        [{ userId: "u1" }],
        [{ currentAttemptId: null, status: "not_started", attemptsUsed: 1 }],
        [{ id: "a1", providerJobId: "reservation:a1" }],
        undefined,
      ]);
      await expect(repo.cancelReservation("a1")).resolves.toBe(false);
      expect(calls.some((c) => c.op === "delete" && c.args[0] === bronzeAttempt)).toBe(true);
      expect(setOn(bronzeVerification)).toBeUndefined();
    });

    it("gives the attempt back when it's our side that couldn't get the result", async () => {
      const state = { currentAttemptId: "a1", status: "pending", attemptsUsed: 2 };
      const attempt = { id: "a1", status: "started" };
      const unavailable = queuedDb([[{ userId: "u1" }], [state], [attempt], undefined, undefined]);
      await unavailable.repo.expireAttempt("a1", "RESULT_UNAVAILABLE");
      expect(unavailable.setOn(bronzeAttempt)).toMatchObject({
        failureCodes: ["RESULT_UNAVAILABLE"],
      });
      expect(unavailable.setOn(bronzeVerification)).toEqual({ status: "failed", attemptsUsed: 1 });

      const expired = queuedDb([[{ userId: "u1" }], [state], [attempt], undefined, undefined]);
      await expired.repo.expireAttempt("a1");
      expect(expired.setOn(bronzeVerification)).toEqual({ status: "failed" });
    });

    it("finds reservations that never got a Didit session", async () => {
      const { repo, calls } = queuedDb([[{ id: "a1" }]]);
      await expect(repo.staleReservations(20)).resolves.toEqual([{ id: "a1" }]);
      expect(calls.some((c) => c.op === "from" && c.args[0] === bronzeAttempt)).toBe(true);
    });
  });

  describe("recordCallback", () => {
    const input = {
      attemptId: "a1",
      userId: "u1",
      fingerprint: "f1",
      resultCode: "Approved",
      checks: { ...passedChecks, profileFace: true, country: true },
      status: "verified" as const,
      failureCodes: [],
      identityBinding: "fp-1",
    };
    const attempt = {
      id: "a1",
      checks: {},
      avatarKey: "avatars/u1/a.jpg",
      profileDob: "1998-04-02",
      profileGender: "Female",
      profileCountry: "NG",
    };
    const profileRow = {
      avatarKey: "avatars/u1/a.jpg",
      dateOfBirth: "1998-04-02",
      gender: "Female",
      country: "NG",
    };
    const pending = { currentAttemptId: "a1", status: "pending", attemptsUsed: 1 };

    it("awards the badge when nothing else holds this identity", async () => {
      const { repo, calls, setOn } = queuedDb([
        [pending],
        [{ id: "cb1" }],
        [attempt],
        [profileRow],
        undefined,
        [],
        [],
        undefined,
        undefined,
      ]);
      await expect(repo.recordCallback(input)).resolves.toMatchObject({ status: "verified" });
      expect(calls.some((c) => c.op === "execute")).toBe(true);
      expect(setOn(bronzeVerification)).toMatchObject({ status: "verified", attemptsUsed: 0 });
    });

    it("sends a second account of the same person to an admin, decided under the lock", async () => {
      const { repo, calls, valuesOn } = queuedDb([
        [pending],
        [{ id: "cb1" }],
        [attempt],
        [profileRow],
        undefined,
        [{ id: "other-attempt" }],
        undefined,
        undefined,
        [{ id: "r1" }],
      ]);
      await expect(repo.recordCallback(input)).resolves.toMatchObject({
        status: "manual_review",
        reviewOpened: true,
      });
      const execute = calls.findIndex((c) => c.op === "execute");
      const duplicateQuery = calls.findIndex(
        (c, i) => i > execute && c.op === "from" && c.args[0] === bronzeAttempt,
      );
      expect(execute).toBeGreaterThan(-1);
      expect(duplicateQuery).toBeGreaterThan(execute);
      expect(valuesOn(bronzeReview)).toMatchObject({
        reasonCodes: ["IDENTITY_ON_ANOTHER_ACCOUNT"],
      });
    });

    it("doesn't auto-verify an identity it couldn't fingerprint", async () => {
      const { repo, calls } = queuedDb([
        [pending],
        [{ id: "cb1" }],
        [attempt],
        [profileRow],
        undefined,
        undefined,
        [{ id: "r1" }],
      ]);
      await expect(repo.recordCallback({ ...input, identityBinding: null })).resolves.toMatchObject(
        { status: "manual_review" },
      );
      expect(calls.some((c) => c.op === "execute")).toBe(false);
    });
  });

  describe("decideReview", () => {
    const decision = {
      id: "r1",
      reviewerId: "admin-1",
      decision: "approve" as const,
      evidenceReference: "didit-session-1",
      reason: "Selfie matches the profile photo.",
    };
    const review = { id: "r1", status: "open", userId: "u1", attemptId: "a1" };
    const attempt = { id: "a1", checks: passedChecks, avatarKey: "avatars/u1/a.jpg" };

    it("won't let an admin decide their own verification", async () => {
      const { repo } = queuedDb([[{ ...review, userId: "admin-1" }]]);
      await expect(repo.decideReview(decision)).resolves.toEqual({ ok: false, reason: "own" });
    });

    it("treats a review as closed once the verification stopped waiting on it", async () => {
      const { repo, setOn } = queuedDb([
        [{ userId: "u1" }],
        [{ currentAttemptId: "a1", status: "revoked", attemptsUsed: 1 }],
        [review],
        [attempt],
      ]);
      await expect(repo.decideReview(decision)).resolves.toEqual({ ok: false, reason: "closed" });
      expect(setOn(bronzeVerification)).toBeUndefined();
    });

    it("refuses to approve an attempt whose ID checks failed", async () => {
      const { repo } = queuedDb([
        [{ userId: "u1" }],
        [{ currentAttemptId: "a1", status: "manual_review", attemptsUsed: 1 }],
        [review],
        [{ ...attempt, checks: { ...passedChecks, liveness: false } }],
        [],
      ]);
      await expect(repo.decideReview(decision)).resolves.toEqual({ ok: false, reason: "checks" });
    });

    const approvable = {
      ...attempt,
      profileDob: "1998-04-02",
      profileGender: "Female",
      identityBinding: "fp-1",
    };
    const sameProfile = { avatarKey: "avatars/u1/a.jpg", dob: "1998-04-02", gender: "Female" };
    const waiting = { currentAttemptId: "a1", status: "manual_review", attemptsUsed: 1 };

    it("ends a review whose member changed what was checked, instead of leaving it stuck", async () => {
      const { repo, setOn } = queuedDb([
        [{ userId: "u1" }],
        [waiting],
        [review],
        [approvable],
        [{ ...sameProfile, avatarKey: "avatars/u1/new.jpg" }],
        undefined,
        undefined,
        undefined,
      ]);
      await expect(repo.decideReview(decision)).resolves.toEqual({ ok: false, reason: "changed" });
      expect(setOn(bronzeReview)).toMatchObject({ status: "withdrawn" });
      expect(setOn(bronzeAttempt)).toMatchObject({
        failureCodes: ["PROFILE_CHANGED_DURING_VERIFICATION"],
      });
      expect(setOn(bronzeVerification)).toEqual({ status: "failed" });
    });

    it("approves once the other account has let the identity go", async () => {
      const { repo, setOn } = queuedDb([
        [{ userId: "u1" }],
        [waiting],
        [{ ...review, reasonCodes: ["IDENTITY_ON_ANOTHER_ACCOUNT"] }],
        [approvable],
        [sameProfile],
        undefined,
        [],
        [],
        undefined,
        undefined,
        undefined,
      ]);
      await expect(repo.decideReview(decision)).resolves.toMatchObject({
        ok: true,
        status: "verified",
      });
      expect(setOn(bronzeVerification)).toMatchObject({ status: "verified" });
    });

    it("only rejects an identity still on another account, without repeating the reason", async () => {
      const { repo, setOn } = queuedDb([
        [{ userId: "u1" }],
        [waiting],
        [{ ...review, reasonCodes: ["IDENTITY_ON_ANOTHER_ACCOUNT"] }],
        [approvable],
        [sameProfile],
        undefined,
        [{ id: "other-attempt" }],
      ]);
      await expect(repo.decideReview(decision)).resolves.toEqual({
        ok: false,
        reason: "duplicate",
      });
      expect(setOn(bronzeReview)).toBeUndefined();
    });

    it("won't approve a second account found since the review opened, and shows why", async () => {
      const { repo, setOn, calls } = queuedDb([
        [{ userId: "u1" }],
        [waiting],
        [{ ...review, reasonCodes: ["PROFILE_PHOTO_FACE_MATCH_REQUIRED"] }],
        [approvable],
        [sameProfile],
        undefined,
        [{ id: "other-attempt" }],
        undefined,
      ]);
      await expect(repo.decideReview(decision)).resolves.toEqual({
        ok: false,
        reason: "duplicate",
      });
      expect(calls.some((c) => c.op === "execute")).toBe(true);
      expect(setOn(bronzeReview)).toEqual({
        reasonCodes: ["PROFILE_PHOTO_FACE_MATCH_REQUIRED", "IDENTITY_ON_ANOTHER_ACCOUNT"],
      });
      expect(setOn(bronzeVerification)).toBeUndefined();
    });
  });
});
