import { describe, expect, it } from "vitest";
import { isOfficialOrganization } from "./organization-placeholder.service";

describe("isOfficialOrganization", () => {
  it("matches only the configured immutable user id", () => {
    expect(isOfficialOrganization("official-id", "official-id")).toBe(true);
    expect(isOfficialOrganization("another-id", "official-id")).toBe(false);
  });

  it("fails closed when deployment configuration is absent or blank", () => {
    expect(isOfficialOrganization("official-id", undefined)).toBe(false);
    expect(isOfficialOrganization("official-id", "   ")).toBe(false);
    expect(isOfficialOrganization(null, "official-id")).toBe(false);
  });

  it("does not normalize ids or accidentally match similar values", () => {
    expect(isOfficialOrganization("OFFICIAL-ID", "official-id")).toBe(false);
    expect(isOfficialOrganization("official-id-copy", "official-id")).toBe(false);
  });
});
