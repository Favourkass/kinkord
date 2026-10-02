"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Routes } from "@/constants/Routes";
import type { BronzeReviewPM } from "@/domain/bronzeReview";
import { ApiError } from "@/services/apiClient";
import { bronzeReviewApi } from "@/services/bronzeReview.service";

interface Draft {
  profileFaceMatches: boolean;
  evidenceReference: string;
  reason: string;
}

const emptyDraft = (): Draft => ({ profileFaceMatches: false, evidenceReference: "", reason: "" });

export function useBronzeReviewPresenter() {
  const router = useRouter();
  const [reviews, setReviews] = useState<BronzeReviewPM[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await bronzeReviewApi.list();
      setReviews(rows);
      setDrafts((current) =>
        Object.fromEntries(rows.map((row) => [row.id, current[row.id] ?? emptyDraft()])),
      );
      setError(null);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) router.replace(Routes.login);
      else if (failure instanceof ApiError && failure.status === 403) {
        setError("This page requires a reviewer account that is allowlisted and protected by 2FA.");
      } else setError("The KYC review queue could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const update = (id: string, patch: Partial<Draft>) => {
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? emptyDraft()), ...patch } }));
  };

  const decide = async (id: string, decision: "approve" | "reject") => {
    const draft = drafts[id] ?? emptyDraft();
    if (draft.evidenceReference.trim().length < 3 || draft.reason.trim().length < 10) {
      setError(
        "Add the Didit/internal evidence reference and review notes of at least 10 characters.",
      );
      return;
    }
    if (decision === "approve" && !draft.profileFaceMatches) {
      setError(
        "Approval requires an affirmative match between the Didit live capture and the profile photo.",
      );
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      await bronzeReviewApi.decide(id, { decision, ...draft });
      await load();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "The review decision could not be saved.",
      );
    } finally {
      setBusyId(null);
    }
  };

  return {
    loading,
    error,
    view: {
      title: "KYC review queue",
      guidance:
        "Use the provider reference to inspect the live capture in Didit. Compare it only with the profile photo shown for this attempt. Never copy ID numbers or biometric media into the notes.",
      providerConsoleHref: "https://business.didit.me/",
      empty: reviews.length === 0,
      items: reviews.map((review) => {
        const draft = drafts[review.id] ?? emptyDraft();
        return {
          ...review,
          createdLabel: new Date(review.createdAt).toLocaleString(),
          profileFaceMatches: draft.profileFaceMatches,
          evidenceReference: draft.evidenceReference,
          reason: draft.reason,
          busy: busyId === review.id,
          onProfileFaceMatches: (value: boolean) =>
            update(review.id, { profileFaceMatches: value }),
          onEvidenceReference: (value: string) => update(review.id, { evidenceReference: value }),
          onReason: (value: string) => update(review.id, { reason: value }),
          onApprove: () => {
            void decide(review.id, "approve");
          },
          onReject: () => {
            void decide(review.id, "reject");
          },
        };
      }),
      onRefresh: () => {
        void load();
      },
    },
  };
}
