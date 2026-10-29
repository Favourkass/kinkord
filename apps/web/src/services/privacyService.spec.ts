import { describe, it, expect, vi } from "vitest";
import { savePrivacy, loadPrivacy, selectableAudiences } from "./privacyService";
import { privacyRepository } from "@/repositories/privacyRepository";
vi.mock("@/repositories/privacyRepository", () => ({
  privacyRepository: { read: vi.fn(), update: vi.fn() },
}));
describe("privacy service", () => {
  it("loads the persisted domain settings", async () => {
    await loadPrivacy();
    expect(privacyRepository.read).toHaveBeenCalled();
  });
  it("updates one audience without overwriting other settings", async () => {
    await savePrivacy("profilePhoto", "followers");
    expect(privacyRepository.update).toHaveBeenCalledWith({ profilePhoto: "followers" });
  });
  it("rejects unsupported options and unavailable features", () => {
    expect(() => savePrivacy("bio", "premium")).toThrow();
    expect(() => savePrivacy("stories", "friends")).toThrow();
    // Not offered at all: a pinned post follows its own audience.
    expect(() => savePrivacy("pinnedPosts", "friends")).toThrow();
  });
  it("doesn't offer Verified members while identity verification is off", () => {
    expect(selectableAudiences().map((a) => a.value)).not.toContain("verified");
    expect(selectableAudiences().map((a) => a.value)).toContain("onlyMe");
    expect(() => savePrivacy("bio", "verified")).toThrow();
  });
});
