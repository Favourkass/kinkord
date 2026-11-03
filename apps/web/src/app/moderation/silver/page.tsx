"use client";

import ModerationFrame from "@/components/moderation/ModerationFrame";
import SilverMembersView from "@/components/moderation/SilverMembersView";
import { MODERATION_COPY } from "@/constants/moderation";
import { useSilverMembersPresenter } from "@/presenters/useSilverMembersPresenter";
import { moderationTabs } from "../tabs";

/** Everyone on Silver now, and whether they paid, got a Kink Ring, or were given it. */
export default function ModerationSilverPage() {
  const p = useSilverMembersPresenter();
  const copy = MODERATION_COPY;
  return (
    <ModerationFrame
      title={copy.title}
      tabs={moderationTabs("silver")}
      checking={p.checking}
      isAdmin={p.isAdmin}
      checkingLabel={copy.checking}
      deniedLabel={copy.denied}
    >
      <SilverMembersView {...p.view} />
    </ModerationFrame>
  );
}
