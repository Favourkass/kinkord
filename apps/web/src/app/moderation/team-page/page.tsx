"use client";

import ModerationFrame from "@/components/moderation/ModerationFrame";
import TeamPageAdminView from "@/components/moderation/TeamPageAdminView";
import { MODERATION_COPY } from "@/constants/moderation";
import { useTeamPageAdminPresenter } from "@/presenters/useTeamPageAdminPresenter";
import { moderationTabs } from "../tabs";

export default function ModerationTeamPage() {
  const p = useTeamPageAdminPresenter();
  const copy = MODERATION_COPY;
  return (
    <ModerationFrame
      title={copy.title}
      tabs={moderationTabs("team-page")}
      checking={p.checking}
      isAdmin={p.isAdmin}
      checkingLabel={copy.checking}
      deniedLabel={copy.denied}
    >
      <TeamPageAdminView
        loading={p.loading}
        error={p.error}
        empty={p.empty}
        rows={p.rows}
        canManage={p.canManage}
        notice={p.notice}
        dialog={p.dialog}
        pageHref={p.pageHref}
        edit={p.edit}
        remove={p.remove}
        form={p.form}
        labels={p.labels}
      />
    </ModerationFrame>
  );
}
