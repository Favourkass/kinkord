"use client";

import AppShell from "@/components/app/AppShell";
import BronzeReviewView from "@/components/settings/BronzeReviewView";
import KycReviewQueueView from "@/components/settings/KycReviewQueueView";
import { appShellProps, getAppShellNav } from "@/presenters/getAppShellNav";
import { useBronzeReviewPresenter } from "@/presenters/useBronzeReviewPresenter";
import { useHomePresenter } from "@/presenters/useHomePresenter";
import { useKycReviewPresenter } from "@/presenters/useKycReviewPresenter";

export default function KycReviewPage() {
  const shell = useHomePresenter();
  const identityReviews = useBronzeReviewPresenter();
  const kycReviews = useKycReviewPresenter();
  return <AppShell {...appShellProps(shell, getAppShellNav())} activeNav="settings">
    <div className="mx-auto w-full max-w-[860px] px-[18px] pb-8 pt-5 lg:px-0">
      {identityReviews.loading || kycReviews.loading ? <p className="text-app-subtle">Loading...</p> : null}
      {!kycReviews.loading && !kycReviews.error ? <KycReviewQueueView {...kycReviews.view} /> : null}
      {kycReviews.error ? <p role="alert" className="rounded-xl border border-red-500/40 bg-red-950/20 p-4 text-sm font-semibold text-red-400">{kycReviews.error}</p> : null}
      {!identityReviews.loading && !identityReviews.error ? <div className="mt-8 border-t border-app-card-border pt-8"><BronzeReviewView {...identityReviews.view} /></div> : null}
      {identityReviews.error ? <p role="alert" className="mt-5 rounded-xl border border-red-500/40 bg-red-950/20 p-4 text-sm font-semibold text-red-400">{identityReviews.error}</p> : null}
    </div>
  </AppShell>;
}
