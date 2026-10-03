"use client";

import { useParams } from "next/navigation";
import MemberDetailView from "@/components/moderation/MemberDetailView";
import ModerationFrame from "@/components/moderation/ModerationFrame";
import { MODERATION_COPY } from "@/constants/moderation";
import { useAdminMemberPresenter } from "@/presenters/useAdminMemberPresenter";
import { moderationTabs } from "../../tabs";

export default function ModerationMemberPage() {
  const { id } = useParams<{ id: string }>();
  const p = useAdminMemberPresenter(id);
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
        verification={p.verification}
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
        onRevokeVerification={p.onRevokeVerification}
        onReopenVerification={p.onReopenVerification}
      />
    </ModerationFrame>
  );
}
