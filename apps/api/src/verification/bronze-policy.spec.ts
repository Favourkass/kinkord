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
    expect(interpretDiditResult(decision("Approved"), "NG")).toMatchObject({
      terminal: true,
      failed: false,
      governmentId: true,
      liveness: true,
      idFace: true,
      identity: { IssuingState: "NGA", IssuingStateName: "Nigeria", FullName: "Ada Okafor" },
    });
    expect(interpretDiditResult(decision("Approved", false), "NG").governmentId).toBe(false);
    expect(interpretDiditResult(decision("In Review"), "NG")).toMatchObject({
      terminal: false,
      inProviderReview: true,
    });
    expect(interpretDiditResult(decision("Declined"), "NG")).toMatchObject({
      terminal: true,
      failed: true,
    });
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
