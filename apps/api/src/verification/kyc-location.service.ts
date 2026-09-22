import { BadRequestException, ConflictException, ForbiddenException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { diditProofOfAddressCoordinate } from "./didit-kyc-evidence";
import { DiditService } from "./didit.service";
import { KycRepository } from "./kyc.repository";

export const KYC_LOCATION_POLICY_VERSION = "kyc-location-2026-09-22-v1";

export function kilometreDistance(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const radians = (value: number) => value * Math.PI / 180;
  const earthRadiusKm = 6371;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

@Injectable()
export class KycLocationService {
  constructor(private readonly repository: KycRepository, private readonly didit: DiditService) {}

  get enabled() { return process.env.KYC_LOCATION_ENABLED === "true" && this.didit.configured; }
  get maximumDistanceKm() {
    const configured = Number(process.env.KYC_GPS_RESIDENCE_DISTANCE_KM ?? "50");
    return Number.isFinite(configured) && configured >= 1 && configured <= 250 ? configured : 50;
  }

  async capture(userId: string, coordinates: { latitude: number; longitude: number; accuracyMetres: number }) {
    if (!this.enabled) throw new ServiceUnavailableException("Live-location verification is not enabled.");
    if (!await this.repository.hasActiveConsent(userId, "location", KYC_LOCATION_POLICY_VERSION)) {
      throw new ForbiddenException("Location consent is required before requesting live location.");
    }
    const attempt = await this.repository.latestDiditResidenceAttempt(userId);
    if (!attempt) throw new ConflictException("Complete approved proof-of-address verification before confirming live location.");
    const decision = await this.didit.decision(attempt.providerSessionReference);
    const residenceCoordinate = diditProofOfAddressCoordinate(decision);
    if (!residenceCoordinate) throw new BadRequestException("The proof-of-address result does not contain a usable location. Contact support for review.");
    const distanceKm = kilometreDistance(coordinates, residenceCoordinate);
    const withinThreshold = distanceKm <= this.maximumDistanceKm;
    const accuracyAcceptable = coordinates.accuracyMetres <= 2_000;
    const status = withinThreshold && accuracyAcceptable ? "passed" as const : "under_review" as const;
    await this.repository.upsertDerivedStageResult({
      userId, attemptId: attempt.id, stage: "location", provider: "kinkord-gps",
      providerReference: attempt.providerSessionReference, status,
      summary: { gpsCaptured: true, accuracyAcceptable, withinResidenceThreshold: withinThreshold },
      reasonCodes: status === "passed" ? [] : [accuracyAcceptable ? "GPS_RESIDENCE_DISTANCE_EXCEEDED" : "GPS_ACCURACY_INSUFFICIENT"],
    });
    return { status };
  }
}
