import { describe, expect, it, vi } from "vitest";
import type { Db } from "../db/db.module";
import { bronzeAttempt, bronzeReview, bronzeVerification } from "../db/schema";
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
  return { repo: new BronzeRepository(chain() as Db), calls, setOn };
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
      const { repo, setOn } = queuedDb([[{ userId: "u1" }], undefined, undefined]);
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
        [review],
        [attempt],
        [{ currentAttemptId: "a1", status: "revoked", attemptsUsed: 1 }],
      ]);
      await expect(repo.decideReview(decision)).resolves.toEqual({ ok: false, reason: "closed" });
      expect(setOn(bronzeVerification)).toBeUndefined();
    });

    it("refuses to approve an attempt whose ID checks failed", async () => {
      const { repo } = queuedDb([
        [review],
        [{ ...attempt, checks: { ...passedChecks, liveness: false } }],
        [{ currentAttemptId: "a1", status: "manual_review", attemptsUsed: 1 }],
      ]);
      await expect(repo.decideReview(decision)).resolves.toEqual({ ok: false, reason: "checks" });
    });
  });
});
