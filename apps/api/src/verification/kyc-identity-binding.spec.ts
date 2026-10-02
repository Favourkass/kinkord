import { describe, expect, it } from "vitest";
import { identityBindingsMatch, kycIdentityBinding } from "./kyc-identity-binding";

const secret = "test-only-identity-binding-secret-that-is-long-enough";

describe("KYC identity binding", () => {
  it("matches normalized identity values without retaining the legal name", () => {
    const a = kycIdentityBinding(
      { fullName: " Ada   Okafor ", dateOfBirth: "1990-02-03", gender: "Female" },
      secret,
    );
    const b = kycIdentityBinding(
      { fullName: "ada-okafor", dateOfBirth: "1990-02-03", gender: "F" },
      secret,
    );
    expect(identityBindingsMatch(a, b)).toBe(true);
    expect(a).not.toContain("ada");
  });

  it("does not match a different bank identity", () => {
    const id = kycIdentityBinding(
      { fullName: "Ada Okafor", dateOfBirth: "1990-02-03", gender: "F" },
      secret,
    );
    const bank = kycIdentityBinding(
      { fullName: "Ada Okoro", dateOfBirth: "1990-02-03", gender: "F" },
      secret,
    );
    expect(identityBindingsMatch(id, bank)).toBe(false);
  });
});
