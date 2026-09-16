import { describe, expect, it } from "vitest";
import { BRONZE_MAX_ATTEMPTS, canAwardBronze, emptyBronzeChecks, interpretSmileResult, matchIdentity } from "./bronze-policy";

describe("Bronze policy", () => {
  it("never grants Bronze for only Smile's ID and liveness approval", () => {
    const checks = { ...emptyBronzeChecks(), governmentId: true, liveness: true, idFace: true };
    expect(canAwardBronze(checks)).toBe(false);
    expect(canAwardBronze({ ...checks, profileFace: true, dateOfBirth: true, gender: true, country: true })).toBe(true);
    expect(BRONZE_MAX_ATTEMPTS).toBe(3);
  });

  it("treats provisional and missing checks as not approved", () => {
    expect(interpretSmileResult({ ResultText: "Provisionally Approved", Actions: { Liveness_Check: "Under Review" } })).toMatchObject({ underReview: true, live: false, verified: false });
    expect(interpretSmileResult({ ResultCode: "0811", Actions: { Selfie_To_ID_Authority_Compare: "Completed" } })).toMatchObject({ face: false, failed: true });
    expect(interpretSmileResult({ ResultCode: "0810", Actions: { Liveness_Check: "Passed", Selfie_To_ID_Authority_Compare: "Completed" } })).toMatchObject({ face: true, live: true });
  });

  it("requires all personal fields from authority to match", () => {
    const profile = { dob: "1998-04-02", gender: "Female", country: "NG" };
    expect(matchIdentity({ DOB: "1998-04-02", Gender: "F", Country: "NG" }, profile)).toEqual({ dateOfBirth: true, gender: true, country: true });
    expect(matchIdentity({ DOB: "1998-04-02" }, profile)).toMatchObject({ gender: false, country: false });
    expect(matchIdentity({ DOB: "2010-04-02", Gender: "F", Country: "NG" },
      { ...profile, dob: "2010-04-02" }, new Date("2026-09-16"))).toMatchObject({ dateOfBirth: false });
  });
});
