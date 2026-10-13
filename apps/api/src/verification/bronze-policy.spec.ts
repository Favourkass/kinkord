import { describe, expect, it } from "vitest";
import {
  BRONZE_MAX_ATTEMPTS,
  bronzeCallbackOutcome,
  canAwardBronze,
  emptyBronzeChecks,
  idChecksPass,
  idCountryMatches,
  interpretDiditResult,
  matchIdentity,
  stillVerified,
} from "./bronze-policy";

const idOnly = { ...emptyBronzeChecks(), governmentId: true, liveness: true, idFace: true };
const allButPhoto = { ...idOnly, dateOfBirth: true, gender: true, country: true };

describe("Bronze policy", () => {
  it("needs every check, the profile photo included, for the badge", () => {
    expect(canAwardBronze(idOnly)).toBe(false);
    expect(canAwardBronze(allButPhoto)).toBe(false);
    expect(canAwardBronze({ ...allButPhoto, profileFace: true })).toBe(true);
    expect(BRONZE_MAX_ATTEMPTS).toBe(3);
  });

  it("separates what only the ID proves from what an admin may confirm", () => {
    expect(idChecksPass({ ...allButPhoto, country: false })).toBe(true);
    expect(idChecksPass({ ...allButPhoto, dateOfBirth: false })).toBe(false);
  });

  it("matches birth date and gender, and an adult only", () => {
    const profile = { dob: "1998-04-02", gender: "Female", country: "NG", nationality: null };
    const id = { DOB: "1998-04-02", Gender: "F", IssuingState: "NGA", IssuingStateName: "Nigeria" };
    expect(matchIdentity(id, profile)).toEqual({ dateOfBirth: true, gender: true, country: true });
    expect(matchIdentity({ ...id, DOB: "1998-04-03", Gender: "M" }, profile)).toMatchObject({
      dateOfBirth: false,
      gender: false,
    });
    expect(
      matchIdentity(
        { ...id, DOB: "2010-04-02" },
        { ...profile, dob: "2010-04-02" },
        new Date("2026-09-16"),
      ),
    ).toMatchObject({ dateOfBirth: false });
  });

  it("matches the ID's country to nationality first, then country, by name", () => {
    const ghanaPassport = { IssuingState: "GHA", IssuingStateName: "Ghana" };
    expect(idCountryMatches(ghanaPassport, { country: "NG", nationality: "GH" })).toBe(true);
    expect(idCountryMatches(ghanaPassport, { country: "NG", nationality: null })).toBe(false);
    expect(
      idCountryMatches(
        { IssuingState: "CIV", IssuingStateName: "Cote d'Ivoire" },
        { country: "CI", nationality: null },
      ),
    ).toBe(true);
  });

  const nigerian = { country: "NG", nationality: null };

  it("reads Didit's decision, including Nigeria's registry check and its own review", () => {
    const decision = (status: string, lookup = true) => ({
      status,
      id_verifications: [
        {
          status: "Approved",
          date_of_birth: "1998-04-02",
          gender: "F",
          issuing_state: "NGA",
          issuing_state_name: "Nigeria",
          full_name: "Ada Okafor",
          ...(lookup ? { id_lookup: { outcome: "match", source: "NIMC" } } : {}),
        },
      ],
      liveness_checks: [{ status: "Approved" }],
      face_matches: [{ status: "Approved" }],
    });
    expect(interpretDiditResult(decision("Approved"), nigerian)).toMatchObject({
      terminal: true,
      failed: false,
      governmentId: true,
      liveness: true,
      idFace: true,
      identity: { IssuingState: "NGA", IssuingStateName: "Nigeria", FullName: "Ada Okafor" },
    });
    expect(interpretDiditResult(decision("Approved", false), nigerian).governmentId).toBe(false);
    expect(interpretDiditResult(decision("In Review"), nigerian)).toMatchObject({
      terminal: false,
      inProviderReview: true,
    });
    expect(interpretDiditResult(decision("Declined"), nigerian)).toMatchObject({
      terminal: true,
      failed: true,
    });
  });

  describe("the Nigerian registry rule follows the ID, not the editable profile", () => {
    const decision = (issuingState: string, extra: Record<string, unknown> = {}) => ({
      status: "Approved",
      id_verifications: [
        {
          status: "Approved",
          date_of_birth: "1998-04-02",
          gender: "F",
          issuing_state: issuingState,
          issuing_state_name: issuingState === "NGA" ? "Nigeria" : "United Kingdom",
          full_name: "Ada Okafor",
        },
      ],
      liveness_checks: [{ status: "Approved" }],
      face_matches: [{ status: "Approved" }],
      ...extra,
    });
    const registry = (outcome: string, status = "Approved") => ({
      database_validations: [
        { status, validations: [{ service_id: "nga_national_id", outcome_code: outcome }] },
      ],
    });

    it("needs a registry match for a Nigerian ID even when the profile says elsewhere", () => {
      const abroad = { country: "GB", nationality: "NG" };
      expect(interpretDiditResult(decision("NGA"), abroad).governmentId).toBe(false);
      expect(interpretDiditResult(decision("NGA", registry("MATCH")), abroad).governmentId).toBe(
        true,
      );
    });

    it("never asks a foreign ID for a Nigerian registry match", () => {
      expect(interpretDiditResult(decision("GBR"), nigerian).governmentId).toBe(true);
    });

    it("falls back to the profile only when Didit couldn't read the ID's country", () => {
      expect(interpretDiditResult(decision(""), nigerian).governmentId).toBe(false);
      expect(
        interpretDiditResult(decision(""), { country: "GH", nationality: null }).governmentId,
      ).toBe(true);
    });

    it("accepts a partial match only once Didit's reviewer has approved it", () => {
      expect(
        interpretDiditResult(decision("NGA", registry("PARTIAL_MATCH")), nigerian).governmentId,
      ).toBe(true);
      expect(
        interpretDiditResult(decision("NGA", registry("PARTIAL_MATCH", "In Review")), nigerian)
          .governmentId,
      ).toBe(false);
      expect(
        interpretDiditResult(decision("NGA", registry("NO_MATCH", "Declined")), nigerian)
          .governmentId,
      ).toBe(false);
    });
  });

  it("reports Didit's duplicate and under-age warnings, even on a declined ID", () => {
    const declined = (risk: string, dob = "1998-04-02") => ({
      status: "Declined",
      id_verifications: [
        { status: "Declined", date_of_birth: dob, warnings: [{ risk, log_type: "error" }] },
      ],
    });
    const now = new Date("2026-10-13");
    expect(
      interpretDiditResult(declined("POSSIBLE_DUPLICATED_USER"), nigerian, now).possibleDuplicate,
    ).toBe(true);
    expect(interpretDiditResult(declined("MINIMUM_AGE_NOT_MET"), nigerian, now).underage).toBe(
      true,
    );
    expect(
      interpretDiditResult(declined("DOCUMENT_EXPIRED", "2010-01-01"), nigerian, now),
    ).toMatchObject({ underage: true, possibleDuplicate: false });
    expect(interpretDiditResult(declined("DOCUMENT_EXPIRED"), nigerian, now).underage).toBe(false);
  });

  it("sends a possible second account, or an identity it can't fingerprint, to an admin", () => {
    const input = {
      checks: { ...allButPhoto, profileFace: true },
      status: "verified" as const,
      failureCodes: [],
      attemptNumber: 1,
      profileUnchanged: true,
    };
    expect(bronzeCallbackOutcome({ ...input, duplicate: true })).toMatchObject({
      status: "manual_review",
      failureCodes: ["IDENTITY_ON_ANOTHER_ACCOUNT"],
    });
    expect(bronzeCallbackOutcome({ ...input, bindingMissing: true })).toMatchObject({
      status: "manual_review",
      failureCodes: ["IDENTITY_FINGERPRINT_UNAVAILABLE"],
    });
    expect(bronzeCallbackOutcome(input).status).toBe("verified");
    // A failed ID stays failed; there's nothing for an admin to approve.
    expect(
      bronzeCallbackOutcome({
        ...input,
        status: "failed",
        failureCodes: ["DIDIT_DECLINED"],
        duplicate: true,
      }).status,
    ).toBe("failed");
  });

  it("lets a member retry a failed attempt, and ends at the last one", () => {
    const input = {
      checks: allButPhoto,
      failureCodes: ["DIDIT_DECLINED"],
      attemptNumber: 1,
      profileUnchanged: true,
    };
    expect(bronzeCallbackOutcome({ ...input, status: "failed" }).status).toBe("failed");
    expect(bronzeCallbackOutcome({ ...input, status: "failed", attemptNumber: 3 }).status).toBe(
      "rejected",
    );
  });

  it("sends an unconfirmed country or photo to an admin with the reason", () => {
    const outcome = bronzeCallbackOutcome({
      checks: { ...allButPhoto, country: false, profileFace: true },
      status: "verified",
      failureCodes: [],
      attemptNumber: 1,
      profileUnchanged: true,
    });
    expect(outcome).toMatchObject({
      status: "manual_review",
      failureCodes: ["ID_COUNTRY_UNCONFIRMED"],
    });
  });

  it("fails a changed profile instead of opening an impossible review", () => {
    const outcome = bronzeCallbackOutcome({
      checks: { ...allButPhoto, profileFace: true },
      status: "verified",
      failureCodes: [],
      attemptNumber: 1,
      profileUnchanged: false,
    });
    expect(outcome).toMatchObject({
      status: "failed",
      checks: { profileFace: false },
      failureCodes: ["PROFILE_CHANGED_DURING_VERIFICATION"],
    });
  });

  it("keeps the badge only while the verified photo, birth date and gender stay", () => {
    const state = {
      status: "verified",
      verifiedAvatarKey: "avatars/u1/a.jpg",
      verifiedDob: "1998-04-02",
      verifiedGender: "female",
    };
    const profile = { avatarKey: "avatars/u1/a.jpg", dateOfBirth: "1998-04-02", gender: "female" };
    expect(stillVerified(state, profile)).toBe(true);
    expect(stillVerified(state, { ...profile, dateOfBirth: "2001-01-01" })).toBe(false);
    expect(stillVerified(state, { ...profile, avatarKey: "avatars/u1/b.jpg" })).toBe(false);
    expect(stillVerified({ ...state, status: "revoked" }, profile)).toBe(false);
    expect(stillVerified(null, profile)).toBe(false);
  });
});
