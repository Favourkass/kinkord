import { describe, expect, it } from "vitest";
import { liveCaptureUrl, profileMatchDecision } from "./profile-match-policy";
import { bronzeCallbackOutcome, canAwardBronze, emptyBronzeChecks } from "./bronze-policy";

const passed = () => ({
  request_id: "request-1",
  face_match: {
    status: "Approved",
    score: 99,
    warnings: [],
    user_image: { entities: [{ confidence: 0.99 }] },
    ref_image: { entities: [{ confidence: 0.99 }] },
  },
});

describe("Profile comparison policy", () => {
  it("accepts only a clean single-face comparison above the configured threshold", () => {
    expect(profileMatchDecision(passed(), 90, "sandbox")).toMatchObject({
      outcome: "matched",
      score: 99,
      mode: "sandbox",
    });
  });
  it.each([90, 50, null, "99", NaN, Infinity, 101, -1])(
    "routes invalid or insufficient score %s to review",
    (score) => {
      const body = passed();
      expect(
        profileMatchDecision({ ...body, face_match: { ...body.face_match, score } }, 90, "live")
          .outcome,
      ).toBe("review");
    },
  );
  it.each([
    { status: "Declined" },
    { warnings: [{ risk: "LOW_FACE_MATCH_SIMILARITY" }] },
    { warnings: undefined },
    { ref_image: { entities: [] } },
    { user_image: { entities: [{}, {}] } },
    { ref_image: null },
  ])("does not approve warnings, missing faces or ambiguous faces", (change) => {
    const body = passed();
    expect(
      profileMatchDecision({ ...body, face_match: { ...body.face_match, ...change } }, 90, "live")
        .outcome,
    ).toBe("review");
  });
  it("uses the liveness reference only, not the ID or a different session's face", () => {
    expect(
      liveCaptureUrl({ face_matches: [{ source_image: "id", target_image: "face" }] }),
    ).toBeNull();
    expect(
      liveCaptureUrl({ liveness_checks: [{ status: "Approved", reference_image: "live" }] }),
    ).toBe("live");
    expect(
      liveCaptureUrl({ liveness_checks: [{ status: "Declined", reference_image: "bad" }] }),
    ).toBeNull();
    expect(
      liveCaptureUrl({
        liveness_checks: [1, 2].map(() => ({ status: "Approved", reference_image: "live" })),
      }),
    ).toBeNull();
  });
});

describe("Badge outcome safety", () => {
  const checks = {
    governmentId: true,
    liveness: true,
    idFace: true,
    profileFace: true,
    dateOfBirth: true,
    gender: true,
    country: true,
  };
  const input = {
    checks,
    status: "verified" as const,
    attemptNumber: 1,
    failureCodes: [],
    profileUnchanged: true,
  };
  it("awards only complete, current-profile results", () => {
    expect(bronzeCallbackOutcome(input).status).toBe("verified");
    expect(bronzeCallbackOutcome({ ...input, profileUnchanged: false })).toMatchObject({
      status: "manual_review",
      checks: { profileFace: false },
      failureCodes: ["PROFILE_CHANGED_DURING_VERIFICATION"],
    });
    for (const key of Object.keys(emptyBronzeChecks()))
      expect(canAwardBronze({ ...checks, [key]: false })).toBe(false);
    expect(canAwardBronze({} as typeof checks)).toBe(false);
  });
  it("preserves review reasons and never promotes failed/review results from old positives", () => {
    expect(
      bronzeCallbackOutcome({
        ...input,
        status: "manual_review",
        failureCodes: ["PROFILE_PHOTO_MATCH_UNAVAILABLE"],
      }),
    ).toMatchObject({ status: "manual_review", failureCodes: ["PROFILE_PHOTO_MATCH_UNAVAILABLE"] });
    expect(bronzeCallbackOutcome({ ...input, status: "failed" }).status).toBe("failed");
    expect(bronzeCallbackOutcome({ ...input, status: "failed", attemptNumber: 3 }).status).toBe(
      "rejected",
    );
  });
});
