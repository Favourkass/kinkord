"use client";

import BlocklistView from "@/components/moderation/BlocklistView";
import ModerationFrame from "@/components/moderation/ModerationFrame";
import { MODERATION_COPY } from "@/constants/moderation";
import { useBlocklistPresenter } from "@/presenters/useBlocklistPresenter";
import { moderationTabs } from "../tabs";

export default function ModerationBlocklistPage() {
  const p = useBlocklistPresenter();
  const copy = MODERATION_COPY;
  return (
    <ModerationFrame
      title={copy.title}
      tabs={moderationTabs("blocklist")}
      checking={p.checking}
      isAdmin={p.isAdmin}
      checkingLabel={copy.checking}
      deniedLabel={copy.denied}
    >
      <BlocklistView
        loading={p.loading}
        error={p.error}
        rows={p.rows}
        empty={p.empty}
        removing={p.removing}
        remove={p.remove}
        form={p.form}
        labels={p.labels}
      />
    </ModerationFrame>
  );
}
