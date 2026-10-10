"use client";

import ModerationFrame from "@/components/moderation/ModerationFrame";
import VerificationReviewView from "@/components/moderation/VerificationReviewView";
import { MODERATION_COPY } from "@/constants/moderation";
import { useAdminVerificationPresenter } from "@/presenters/useAdminVerificationPresenter";
import { moderationTabs } from "../tabs";

export default function ModerationVerificationPage() {
  const p = useAdminVerificationPresenter();
  const copy = MODERATION_COPY;
  return (
    <ModerationFrame
      title={copy.title}
      tabs={moderationTabs("verification")}
      checking={p.checking}
      isAdmin={p.isAdmin}
      checkingLabel={copy.checking}
      deniedLabel={copy.denied}
    >
      <VerificationReviewView
        loading={p.loading}
        error={p.error}
        empty={p.empty}
        rows={p.rows}
        notice={p.notice}
        dialog={p.dialog}
        onApprove={p.onApprove}
        onReject={p.onReject}
        onRefresh={p.onRefresh}
        labels={p.labels}
      />
    </ModerationFrame>
  );
}
