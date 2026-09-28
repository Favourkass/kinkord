import { MODERATION_COPY } from "@/constants/moderation";
import { Routes } from "@/constants/Routes";
import type { ModerationTab } from "@/components/moderation/ModerationFrame";

export function moderationTabs(active: "members" | "blocklist"): ModerationTab[] {
  return [
    { label: MODERATION_COPY.tabs.members, href: Routes.moderation, active: active === "members" },
    {
      label: MODERATION_COPY.tabs.blocklist,
      href: Routes.moderationBlocklist,
      active: active === "blocklist",
    },
  ];
}
