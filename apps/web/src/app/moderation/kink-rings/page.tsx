"use client";

import ModerationFrame from "@/components/moderation/ModerationFrame";
import RingSettingsCard from "@/components/moderation/RingSettingsCard";
import { MODERATION_COPY } from "@/constants/moderation";
import { useRingSettingsPresenter } from "@/presenters/useRingSettingsPresenter";
import { moderationTabs } from "../tabs";

/** How many Kink Rings each Silver plan brings: the founders set it here. */
export default function ModerationKinkRingsPage() {
  const p = useRingSettingsPresenter();
  const copy = MODERATION_COPY;
  return (
    <ModerationFrame
      title={copy.title}
      tabs={moderationTabs("kink-rings")}
      checking={p.checking}
      isAdmin={p.isAdmin}
      checkingLabel={copy.checking}
      deniedLabel={copy.denied}
    >
      <RingSettingsCard {...p.card} />
    </ModerationFrame>
  );
}
