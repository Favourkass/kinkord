"use client";

import LocationChecksView from "@/components/moderation/LocationChecksView";
import ModerationFrame from "@/components/moderation/ModerationFrame";
import { MODERATION_COPY } from "@/constants/moderation";
import { useLocationChecksPresenter } from "@/presenters/useLocationChecksPresenter";
import { moderationTabs } from "../tabs";

export default function ModerationLocationPage() {
  const p = useLocationChecksPresenter();
  const copy = MODERATION_COPY;
  return (
    <ModerationFrame
      title={copy.title}
      tabs={moderationTabs("location")}
      checking={p.checking}
      isAdmin={p.isAdmin}
      checkingLabel={copy.checking}
      deniedLabel={copy.denied}
    >
      <LocationChecksView {...p.view} />
    </ModerationFrame>
  );
}
