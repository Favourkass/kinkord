"use client";

import MemberSearchView from "@/components/moderation/MemberSearchView";
import ModerationFrame from "@/components/moderation/ModerationFrame";
import { MODERATION_COPY } from "@/constants/moderation";
import { useAdminMembersPresenter } from "@/presenters/useAdminMembersPresenter";
import { moderationTabs } from "./tabs";

export default function ModerationMembersPage() {
  const p = useAdminMembersPresenter();
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
      <MemberSearchView
        query={p.query}
        onQuery={p.setQuery}
        placeholder={copy.search.placeholder}
        heading={p.heading}
        loading={p.loading}
        error={p.error}
        empty={p.empty}
        emptyLabel={copy.search.empty}
        rows={p.rows}
      />
    </ModerationFrame>
  );
}
