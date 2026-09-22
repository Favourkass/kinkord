"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Routes } from "@/constants/Routes";
import type { KycReviewPM } from "@/domain/kycReview";
import { ApiError } from "@/services/apiClient";
import { kycReviewApi } from "@/services/kycReview.service";

interface Draft { evidenceReference: string; reason: string; }
const emptyDraft = (): Draft => ({ evidenceReference: "", reason: "" });

export function useKycReviewPresenter() {
  const router = useRouter();
  const [reviews, setReviews] = useState<KycReviewPM[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await kycReviewApi.list();
      setReviews(rows);
      setDrafts((current) => Object.fromEntries(rows.map((row) => [row.id, current[row.id] ?? emptyDraft()])));
      setError(null);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) router.replace(Routes.login);
      else if (failure instanceof ApiError && failure.status === 403) setError("This page requires a KYC reviewer account that is allowlisted and protected by 2FA.");
      else setError("The KYC case queue could not be loaded.");
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const update = (id: string, patch: Partial<Draft>) => {
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? emptyDraft()), ...patch } }));
  };
  const decide = async (id: string, decision: "approve" | "reject") => {
    const draft = drafts[id] ?? emptyDraft();
    if (draft.evidenceReference.trim().length < 3 || draft.reason.trim().length < 10) {
      setError("Add an evidence reference and review notes of at least 10 characters.");
      return;
    }
    setBusyId(id); setError(null);
    try { await kycReviewApi.decide(id, { decision, ...draft }); await load(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "The review decision could not be saved."); }
    finally { setBusyId(null); }
  };

  return {
    loading, error,
    view: {
      title: "KYC case review queue",
      guidance: "Review only the protected provider evidence needed for this stage. Record a provider or internal case reference and a reason, but never copy ID numbers, bank details, location coordinates or biometric material into Kinkord.",
      empty: reviews.length === 0,
      items: reviews.map((review) => {
        const draft = drafts[review.id] ?? emptyDraft();
        return {
          ...review, createdLabel: new Date(review.createdAt).toLocaleString(), evidenceReference: draft.evidenceReference,
          reason: draft.reason, busy: busyId === review.id,
          onEvidenceReference: (value: string) => update(review.id, { evidenceReference: value }),
          onReason: (value: string) => update(review.id, { reason: value }),
          onApprove: () => { void decide(review.id, "approve"); }, onReject: () => { void decide(review.id, "reject"); },
        };
      }),
      onRefresh: () => { void load(); },
    },
  };
}
