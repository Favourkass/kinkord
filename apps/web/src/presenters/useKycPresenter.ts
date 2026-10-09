"use client";

import { useCallback, useEffect, useState } from "react";
import type { KycProgressPM, KycStageStatus } from "@/domain/kyc";
import { ApiError } from "@/services/apiClient";
import { kycApi } from "@/services/kyc.service";

const labels: Record<KycStageStatus, string> = {
  not_started: "Not started",
  pending: "In progress",
  passed: "Complete",
  failed: "Needs attention",
  under_review: "Under review",
  unavailable: "Not available",
  expired: "Expired",
};

export function useKycPresenter() {
  const [progress, setProgress] = useState<KycProgressPM | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationConsentAccepted, setLocationConsentAccepted] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [residenceConsentAccepted, setResidenceConsentAccepted] = useState(false);
  const [residenceBusy, setResidenceBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await kycApi.status();
      setProgress(next);
      setLocationConsentAccepted(next.consents.location);
      setResidenceConsentAccepted(next.consents.residence);
      setError(null);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401)
        setError("Sign in to view your Kinkord KYC progress.");
      else
        setError(
          "KYC progress is temporarily unavailable. You can still complete the available identity stage below.",
        );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const captureLocation = async () => {
    if (!progress?.locationPolicyVersion || !locationConsentAccepted) {
      setError("Confirm the location consent before sharing your live location.");
      return;
    }
    if (!navigator.geolocation) {
      setError("This browser does not support live-location sharing.");
      return;
    }
    setLocationBusy(true);
    setError(null);
    try {
      // Consent is recorded before browser GPS is requested, not after it has been shared.
      if (!progress.consents.location) {
        await kycApi.consent("location", progress.locationPolicyVersion);
      }
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 30_000,
        }),
      );
      await kycApi.submitLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMetres: position.coords.accuracy,
      });
      await load();
    } catch (failure) {
      if (failure && typeof failure === "object" && "code" in failure) {
        setError(
          "We could not obtain your live location. Check browser permissions and try again.",
        );
      } else
        setError(
          failure instanceof Error
            ? failure.message
            : "Live-location verification could not be completed.",
        );
    } finally {
      setLocationBusy(false);
    }
  };

  const recordResidenceConsent = async () => {
    if (!progress?.residencePolicyVersion || !residenceConsentAccepted) {
      setError("Confirm the proof-of-address consent before verifying your residence.");
      return;
    }
    setResidenceBusy(true);
    setError(null);
    try {
      if (!progress.consents.residence) {
        // Consent is recorded before the identity session collects any document.
        await kycApi.consent("residence", progress.residencePolicyVersion);
      }
      const identity = progress.stages.find((stage) => stage.key === "identity");
      if (progress.consents.residence || identity?.status === "passed") {
        await kycApi.refreshResidence();
      }
      await load();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Residence consent could not be recorded.",
      );
    } finally {
      setResidenceBusy(false);
    }
  };

  return {
    loading,
    error,
    view: progress
      ? {
          fullKycVerified: progress.fullKycVerified,
          stages: progress.stages.map((stage) => ({ ...stage, statusLabel: labels[stage.status] })),
          locationConsentAccepted,
          locationBusy,
          residenceConsentAccepted,
          residenceBusy,
          consents: progress.consents,
          residenceEvidenceReady:
            progress.stages.find((stage) => stage.key === "identity")?.status === "passed",
        }
      : null,
    refresh: () => {
      void load();
    },
    setLocationConsentAccepted,
    captureLocation: () => {
      void captureLocation();
    },
    setResidenceConsentAccepted,
    recordResidenceConsent: () => {
      void recordResidenceConsent();
    },
  };
}
