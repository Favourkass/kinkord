"use client";
import ModerationFrame from "@/components/moderation/ModerationFrame";
import AllPostsView from "@/components/moderation/AllPostsView";
import ConfirmDialog from "@/components/moderation/ConfirmDialog";
import { MODERATION_COPY } from "@/constants/moderation";
import { useAdminPostsPresenter } from "@/presenters/useAdminPostsPresenter";
import { moderationTabs } from "../tabs";
export default function AdminPostsPage() {
  const p = useAdminPostsPresenter();
  return (
    <ModerationFrame
      title={MODERATION_COPY.title}
      tabs={moderationTabs("posts")}
      checking={p.checking}
      isAdmin={p.isAdmin}
      checkingLabel={MODERATION_COPY.checking}
      deniedLabel={MODERATION_COPY.denied}
    >
      <AllPostsView
        vm={p.vm}
        status={p.status}
        loading={p.loading}
        error={p.error}
        busy={p.busy}
        onStatus={p.setStatus}
        onPrevious={p.previous}
        onNext={p.next}
        onRetry={p.retry}
        onArchive={p.onArchive}
        onDelete={p.onDelete}
      />
      {p.dialog ? <ConfirmDialog dialog={p.dialog} /> : null}
    </ModerationFrame>
  );
}
