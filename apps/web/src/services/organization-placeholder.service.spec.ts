import { afterEach, describe, expect, it, vi } from "vitest";
import { isOfficialOrganization } from "./organization-placeholder.service";

afterEach(() => vi.unstubAllEnvs());

describe("isOfficialOrganization", () => {
  it("matches only the configured immutable user id", () => {
    expect(isOfficialOrganization("official-id", "official-id")).toBe(true);
    expect(isOfficialOrganization("another-id", "official-id")).toBe(false);
  });

  it("fails closed when deployment configuration is empty or blank", () => {
    expect(isOfficialOrganization("official-id", "")).toBe(false);
    expect(isOfficialOrganization("official-id", "   ")).toBe(false);
    expect(isOfficialOrganization(null, "official-id")).toBe(false);
    expect(isOfficialOrganization(undefined, "official-id")).toBe(false);
  });

  it("ignores spaces around the configured id, as a pasted value often has", () => {
    expect(isOfficialOrganization("official-id", "  official-id \n")).toBe(true);
  });

  it("reads the build's setting when none is passed", () => {
    vi.stubEnv("NEXT_PUBLIC_KINKORD_OFFICIAL_USER_ID", "official-id");
    expect(isOfficialOrganization("official-id")).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_KINKORD_OFFICIAL_USER_ID", "");
    expect(isOfficialOrganization("official-id")).toBe(false);
  });

  it("does not normalize ids or accidentally match similar values", () => {
    expect(isOfficialOrganization("OFFICIAL-ID", "official-id")).toBe(false);
    expect(isOfficialOrganization("official-id-copy", "official-id")).toBe(false);
    // Only the setting is trimmed: a member's id is taken exactly as the API gives it.
    expect(isOfficialOrganization(" official-id ", "official-id")).toBe(false);
  });
});
