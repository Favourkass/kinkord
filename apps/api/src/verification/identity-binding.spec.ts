import { describe, expect, it } from "vitest";
import { identityBinding } from "./identity-binding";

const secret = "test-only-identity-binding-secret-that-is-long-enough";

describe("identityBinding", () => {
  it("gives the same person the same fingerprint however the ID spells them", () => {
    const a = identityBinding(
      { fullName: " Ada   Okafor ", dateOfBirth: "1990-02-03", gender: "Female" },
      secret,
    );
    const b = identityBinding(
      { fullName: "ada-okafor", dateOfBirth: "1990-02-03T00:00:00Z", gender: "F" },
      secret,
    );
    expect(a).toBe(b);
    expect(a).not.toContain("ada");
  });

  it("tells different people apart", () => {
    const ada = identityBinding(
      { fullName: "Ada Okafor", dateOfBirth: "1990-02-03", gender: "F" },
      secret,
    );
    const other = identityBinding(
      { fullName: "Ada Okoro", dateOfBirth: "1990-02-03", gender: "F" },
      secret,
    );
    expect(ada).not.toBe(other);
  });

  it("gives nothing for an ID with too little on it, and refuses a short key", () => {
    expect(identityBinding({ fullName: "", dateOfBirth: "1990-02-03", gender: "F" }, secret)).toBe(
      null,
    );
    expect(() =>
      identityBinding({ fullName: "Ada", dateOfBirth: "1990-02-03", gender: "F" }, "short"),
    ).toThrow("not configured");
  });
});
