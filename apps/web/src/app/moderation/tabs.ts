import { MODERATION_COPY } from "@/constants/moderation";
import { Routes } from "@/constants/Routes";
import type { ModerationTab } from "@/components/moderation/ModerationFrame";

export function moderationTabs(
  active: "members" | "reports" | "payments" | "wallet" | "blocklist",
): ModerationTab[] {
  return [
    { label: "Wallet", href: Routes.moderationWallet, active: active === "wallet" },
    { label: MODERATION_COPY.tabs.members, href: Routes.moderation, active: active === "members" },
    {
      label: MODERATION_COPY.tabs.reports,
      href: Routes.moderationReports,
      active: active === "reports",
    },
    {
      label: MODERATION_COPY.tabs.payments,
      href: Routes.moderationPayments,
      active: active === "payments",
    },
    {
      label: MODERATION_COPY.tabs.blocklist,
      href: Routes.moderationBlocklist,
      active: active === "blocklist",
    },
  ];
}
