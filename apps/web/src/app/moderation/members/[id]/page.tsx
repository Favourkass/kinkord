"use client";

import { useParams } from "next/navigation";
import ConfirmDialog from "@/components/moderation/ConfirmDialog";
import MemberDetailView from "@/components/moderation/MemberDetailView";
import MemberSilverCheck from "@/components/moderation/MemberSilverCheck";
import ModerationFrame from "@/components/moderation/ModerationFrame";
import { MODERATION_COPY } from "@/constants/moderation";
import { useAdminMemberCheckPresenter } from "@/presenters/useAdminMemberCheckPresenter";
import { useAdminMemberPresenter } from "@/presenters/useAdminMemberPresenter";
import { moderationTabs } from "../../tabs";

export default function ModerationMemberPage() {
  const { id } = useParams<{ id: string }>();
  const p = useAdminMemberPresenter(id);
  const c = useAdminMemberCheckPresenter(id, p.isAdmin);
  const copy = MODERATION_COPY;
  return (
    <ModerationFrame
      title={copy.title}
      tabs={moderationTabs("members")}
      checking={p.checking}
      isAdmin={p.isAdmin}
      checkingLabel={copy.checking}
      deniedLabel={copy.denied}
    >
      <MemberDetailView
        vm={p.vm}
        loading={p.loading}
        error={p.error}
        notice={p.notice}
        dialog={p.dialog}
        labels={p.labels}
        backHref={p.backHref}
        onBlock={p.onBlock}
        onUnblock={p.onUnblock}
        onDeletePosts={p.onDeletePosts}
        onDeleteAccount={p.onDeleteAccount}
        onDeletePost={p.onDeletePost}
        silverCheck={
          c.vm ? (
            <MemberSilverCheck
              vm={c.vm}
              error={c.error}
              notice={c.notice}
              busy={c.busy}
              onApprove={c.onApprove}
              onRemove={c.onRemove}
              labels={c.labels}
            />
          ) : null
        }
      />
      {c.dialog ? <ConfirmDialog dialog={c.dialog} /> : null}
    </ModerationFrame>
  );
}
