import { describe, expect, it } from "vitest";
import {
  canStartVerification,
  hasAttemptOpen,
  isSafeLaunchUrl,
  photoSettling,
  type BronzeVerificationPM,
} from "./bronzeVerification";

const NOW = Date.parse("2026-10-03T12:00:00Z");

const pm = (over: Partial<BronzeVerificationPM> = {}): BronzeVerificationPM => ({
  available: true,
  status: "not_started",
  attemptsUsed: 0,
  attemptsRemaining: 3,
  consented: false,
  policyVersion: "bronze-2026-10-03-identity-v3",
  policyUrl: "https://kinkord.com/privacy/verification",
  missing: [],
  photoReadyAt: null,
  ...over,
});

describe("canStartVerification", () => {
  it("lets a member start, retry after a failure, or re-verify after a profile change", () => {
    expect(canStartVerification(pm(), NOW)).toBe(true);
    expect(canStartVerification(pm({ status: "failed", attemptsRemaining: 1 }), NOW)).toBe(true);
    expect(canStartVerification(pm({ status: "outdated" }), NOW)).toBe(true);
  });

  it("holds back while switched off, in progress, decided, or out of attempts", () => {
    expect(canStartVerification(pm({ available: false }), NOW)).toBe(false);
    for (const status of ["pending", "manual_review", "verified", "rejected", "revoked"] as const)
      expect(canStartVerification(pm({ status }), NOW)).toBe(false);
    expect(canStartVerification(pm({ status: "failed", attemptsRemaining: 0 }), NOW)).toBe(false);
  });

  it("waits for a complete profile and a photo that has settled", () => {
    expect(canStartVerification(pm({ missing: ["profilePhoto"] }), NOW)).toBe(false);
    const settling = pm({ photoReadyAt: new Date(NOW + 60_000).toISOString() });
    expect(photoSettling(settling, NOW)).toBe(true);
    expect(canStartVerification(settling, NOW)).toBe(false);
    expect(canStartVerification(settling, NOW + 61_000)).toBe(true);
  });
});

describe("hasAttemptOpen", () => {
  it("is open until a check is under way, decided, or out of attempts", () => {
    expect(hasAttemptOpen(pm({ missing: ["gender"] }))).toBe(true);
    expect(hasAttemptOpen(pm({ status: "pending" }))).toBe(false);
    expect(hasAttemptOpen(pm({ status: "failed", attemptsRemaining: 0 }))).toBe(false);
  });
});

describe("isSafeLaunchUrl", () => {
  it("only sends members to Didit's hosted check over HTTPS", () => {
    expect(isSafeLaunchUrl("https://verify.didit.me/session/abc")).toBe(true);
    expect(isSafeLaunchUrl("http://verify.didit.me/session/abc")).toBe(false);
    expect(isSafeLaunchUrl("https://verify.didit.me.evil.example/x")).toBe(false);
    expect(isSafeLaunchUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeLaunchUrl("not a url")).toBe(false);
  });
});
