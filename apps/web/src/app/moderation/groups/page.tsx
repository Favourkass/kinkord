"use client";
import AllGroupsView from "@/components/moderation/AllGroupsView";
import ConfirmDialog from "@/components/moderation/ConfirmDialog";
import ModerationFrame from "@/components/moderation/ModerationFrame";
import { MODERATION_COPY } from "@/constants/moderation";
import { useAdminGroupsPresenter } from "@/presenters/useAdminGroupsPresenter";
import { moderationTabs } from "../tabs";

export default function AdminGroupsPage() {
  const p = useAdminGroupsPresenter();
  return (
    <ModerationFrame
      title={MODERATION_COPY.title}
      tabs={moderationTabs("groups")}
      checking={p.checking}
      isAdmin={p.isAdmin}
      checkingLabel={MODERATION_COPY.checking}
      deniedLabel={MODERATION_COPY.denied}
    >
      <AllGroupsView
        title={p.title}
        intro={p.intro}
        status={p.status}
        statuses={p.statuses}
        onStatus={p.setStatus}
        loading={p.loading}
        error={p.error}
        empty={p.empty}
        rows={p.rows}
        previous={p.previous}
        next={p.next}
        onRetry={p.retry}
      />
      {p.dialog ? <ConfirmDialog dialog={p.dialog} /> : null}
    </ModerationFrame>
  );
}
