import { describe, it, expect, vi } from "vitest";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PrivacyService } from "./privacy.service";
import type { PrivacyRepository } from "./privacy.repository";
import { effectivePrivacy, PRIVACY_FIELDS } from "./privacy-policy";
const setup = (legacy = "public") => {
  const read = vi.fn(async () => ({ settings: { bio: "friends" as const }, legacy }));
  const patch = vi.fn(async (_id: string, settings: object) => ({ settings, legacy }));
  const service = new PrivacyService({ read, patch } as unknown as PrivacyRepository);
  return { service, read, patch };
};
describe("PrivacyService", () => {
  it("keeps existing friends-only About fields restricted until explicitly changed", () => {
    const defaults = effectivePrivacy(null, "friends");
    expect(defaults.bio).toBe("friends");
    expect(defaults.media).toBe("friends");
    expect(defaults.relationshipStatus).toBe("friends");
    expect(defaults.profilePhoto).toBe("members");
    expect(Object.keys(defaults)).toHaveLength(PRIVACY_FIELDS.length);
  });
  it("returns persisted settings with defaults for untouched fields", async () => {
    const { service } = setup();
    expect((await service.get("self")).settings).toMatchObject({
      bio: "friends",
      directory: "members",
      messaging: "members",
    });
  });
  it("writes only touched fields for the authenticated member", async () => {
    const { service, patch } = setup();
    const result = await service.update("self", { bio: "continent", location: "country" });
    expect(patch).toHaveBeenCalledWith("self", { bio: "continent", location: "country" });
    expect(result.settings.bio).toBe("continent");
  });
  it.each([
    { bio: ["friends", "followers"] },
    { bio: "premium" },
    { userId: "other", bio: "members" },
    { unknown: "friends" },
    { stories: "friends" },
    // A pinned post follows its own audience.
    { pinnedPosts: "country" },
    // Nobody can verify while identity verification is off.
    { profilePhoto: "verified" },
  ])("rejects invalid or unavailable settings: %j", async (body) => {
    const { service, patch } = setup();
    await expect(service.update("self", body)).rejects.toBeInstanceOf(BadRequestException);
    expect(patch).not.toHaveBeenCalled();
  });
  it("saves messaging permissions independently of visibility settings", async () => {
    const { service, patch } = setup();
    expect((await service.update("self", { messaging: "onlyMe" })).settings.messaging).toBe(
      "onlyMe",
    );
    expect(patch).toHaveBeenCalledWith("self", { messaging: "onlyMe" });
  });
  it("does not create settings for a missing profile", async () => {
    const { service, read, patch } = setup();
    read.mockResolvedValueOnce(null as never);
    await expect(service.update("missing", { bio: "friends" })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(patch).not.toHaveBeenCalled();
  });
});
