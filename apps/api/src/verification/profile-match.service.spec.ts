import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileMatchService } from "./profile-match.service";
import type { BronzeRepository } from "./bronze.repository";
import type { DiditService } from "./didit.service";
import type { StorageService } from "../storage/storage.service";

describe("ProfileMatchService", () => {
  const repo = { hasConsent: vi.fn(), claimProfileMatch: vi.fn(), completeProfileMatch: vi.fn() };
  const didit = { profileMatchEnabled: true, mode: "sandbox", profileMatchThreshold: 90, compareProfilePhoto: vi.fn() };
  const storage = { readVerificationImage: vi.fn() };
  const service = new ProfileMatchService(repo as unknown as BronzeRepository, didit as unknown as DiditService,
    storage as unknown as StorageService);
  const attempt = { id: "a1", userId: "u1", avatarKey: "avatars/u1/original.jpg" };
  const decision = { liveness_checks: [{ status: "Approved", reference_image: "https://media.didit.me/selfie" }] };
  const result = { outcome: "matched", reason: null, score: 99, threshold: 90, mode: "sandbox", requestId: "r1", providerStatus: "Approved" };
  beforeEach(() => {
    vi.resetAllMocks(); didit.profileMatchEnabled = true;
    repo.hasConsent.mockResolvedValue(true);
    repo.claimProfileMatch.mockResolvedValue({ acquired: true });
    storage.readVerificationImage.mockResolvedValue("profile-bytes");
    didit.compareProfilePhoto.mockResolvedValue(result);
  });
  it("compares the exact attempt snapshot and persists only the derived outcome", async () => {
    expect(await service.evaluate(attempt, decision)).toEqual(result);
    expect(storage.readVerificationImage).toHaveBeenCalledWith(attempt.avatarKey);
    expect(didit.compareProfilePhoto).toHaveBeenCalledWith("https://media.didit.me/selfie", "profile-bytes", attempt.id);
    expect(repo.completeProfileMatch).toHaveBeenCalledWith(attempt.id, result);
  });
  it("requires the newly versioned consent before transferring a profile image", async () => {
    repo.hasConsent.mockResolvedValue(false);
    expect(await service.evaluate(attempt, decision)).toMatchObject({ outcome: "review", reason: "PROFILE_PHOTO_MATCH_CONSENT_REQUIRED" });
    expect(storage.readVerificationImage).not.toHaveBeenCalled();
    expect(repo.claimProfileMatch).not.toHaveBeenCalled();
  });
  it("does not perform a comparison when disabled or the live capture is missing", async () => {
    didit.profileMatchEnabled = false;
    expect(await service.evaluate(attempt, decision)).toMatchObject({ outcome: "review" });
    didit.profileMatchEnabled = true;
    expect(await service.evaluate(attempt, {})).toMatchObject({ reason: "PROFILE_PHOTO_CAPTURE_UNAVAILABLE" });
    expect(didit.compareProfilePhoto).not.toHaveBeenCalled();
  });
  it("reuses durable results and never repeats pending or interrupted requests", async () => {
    repo.claimProfileMatch.mockResolvedValueOnce({ acquired: false, result });
    expect(await service.evaluate(attempt, decision)).toEqual(result);
    repo.claimProfileMatch.mockResolvedValueOnce({ acquired: false, startedAt: new Date() });
    expect(await service.evaluate(attempt, decision)).toBeNull();
    repo.claimProfileMatch.mockResolvedValueOnce({ acquired: false, startedAt: new Date(Date.now() - 121000) });
    expect(await service.evaluate(attempt, decision)).toMatchObject({ reason: "PROFILE_PHOTO_MATCH_INTERRUPTED" });
    expect(didit.compareProfilePhoto).not.toHaveBeenCalled();
  });
  it("routes provider failure to review without caching media or exceptions", async () => {
    didit.compareProfilePhoto.mockRejectedValue(new Error("signed-private-url"));
    expect(await service.evaluate(attempt, decision)).toMatchObject({ outcome: "review", reason: "PROFILE_PHOTO_MATCH_UNAVAILABLE" });
    expect(JSON.stringify(repo.completeProfileMatch.mock.calls)).not.toContain("signed-private-url");
  });
});
