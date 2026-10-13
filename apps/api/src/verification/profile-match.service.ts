import { Injectable, Logger } from "@nestjs/common";
import { StorageService } from "../storage/storage.service";
import { BronzeRepository } from "./bronze.repository";
import { DiditService } from "./didit.service";
import { liveCaptureUrl, type ProfileMatchAudit } from "./profile-match-policy";

@Injectable()
export class ProfileMatchService {
  private readonly logger = new Logger(ProfileMatchService.name);
  constructor(
    private readonly repo: BronzeRepository,
    private readonly didit: DiditService,
    private readonly storage: StorageService,
  ) {}

  /** null means another worker is still processing. Never retry a possibly billed request. */
  async evaluate(
    attempt: { id: string; userId: string; avatarKey: string },
    decision: Record<string, unknown>,
  ): Promise<ProfileMatchAudit | null> {
    const review = (reason: string): ProfileMatchAudit => ({
      outcome: "review",
      reason,
      mode: this.didit.mode,
      threshold: this.didit.profileMatchThreshold,
      score: null,
      requestId: null,
      providerStatus: null,
    });
    if (!this.didit.profileMatchEnabled) return review("PROFILE_PHOTO_FACE_MATCH_REQUIRED");
    // Old consents never authorize the newly introduced transfer of a profile photo.
    if (!(await this.repo.hasConsent(attempt.userId)))
      return review("PROFILE_PHOTO_MATCH_CONSENT_REQUIRED");
    const selfieUrl = liveCaptureUrl(decision);
    if (!selfieUrl) return review("PROFILE_PHOTO_CAPTURE_UNAVAILABLE");
    const claim = await this.repo.claimProfileMatch(attempt.id);
    if (!claim.acquired) {
      if (claim.result) return claim.result;
      if (claim.startedAt && claim.startedAt.getTime() > Date.now() - 120000) return null;
      return review("PROFILE_PHOTO_MATCH_INTERRUPTED");
    }
    let result: ProfileMatchAudit;
    try {
      const profilePhoto = await this.storage.readVerificationImage(attempt.avatarKey);
      result = await this.didit.compareProfilePhoto(selfieUrl, profilePhoto, attempt.id);
    } catch {
      // Do not log provider bodies, signed image URLs, image bytes, or member identity.
      this.logger.warn("Profile comparison unavailable; routing to human review.");
      result = review("PROFILE_PHOTO_MATCH_UNAVAILABLE");
    }
    await this.repo.completeProfileMatch(attempt.id, result);
    return result;
  }
}
