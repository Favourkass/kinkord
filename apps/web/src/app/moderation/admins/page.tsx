"use client";

import AdminTeamView from "@/components/moderation/AdminTeamView";
import ModerationFrame from "@/components/moderation/ModerationFrame";
import { MODERATION_COPY } from "@/constants/moderation";
import { useAdminTeamPresenter } from "@/presenters/useAdminTeamPresenter";
import { moderationTabs } from "../tabs";

export default function ModerationAdminsPage() {
  const p = useAdminTeamPresenter();
  const copy = MODERATION_COPY;
  return (
    <ModerationFrame
      title={copy.title}
      tabs={moderationTabs("admins")}
      checking={p.checking}
      isAdmin={p.isAdmin}
      checkingLabel={copy.checking}
      deniedLabel={copy.denied}
    >
      <AdminTeamView
        loading={p.loading}
        error={p.error}
        rows={p.rows}
        canManage={p.canManage}
        notice={p.notice}
        dialog={p.dialog}
        remove={p.remove}
        form={p.form}
        labels={p.labels}
      />
    </ModerationFrame>
  );
}
