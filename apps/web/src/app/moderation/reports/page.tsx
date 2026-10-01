"use client";

import ModerationFrame from "@/components/moderation/ModerationFrame";
import ReportsView from "@/components/moderation/ReportsView";
import { MODERATION_COPY } from "@/constants/moderation";
import { useAdminReportsPresenter } from "@/presenters/useAdminReportsPresenter";
import { moderationTabs } from "../tabs";

export default function ModerationReportsPage() {
  const p = useAdminReportsPresenter();
  const copy = MODERATION_COPY;
  return (
    <ModerationFrame
      title={copy.title}
      tabs={moderationTabs("reports")}
      checking={p.checking}
      isAdmin={p.isAdmin}
      checkingLabel={copy.checking}
      deniedLabel={copy.denied}
    >
      <ReportsView
        statuses={p.statuses}
        onStatus={p.setStatus}
        loading={p.loading}
        error={p.error}
        empty={p.empty}
        rows={p.rows}
        busy={p.busy}
        onResolve={p.resolve}
        onDismiss={p.dismiss}
        labels={p.labels}
      />
    </ModerationFrame>
  );
}
