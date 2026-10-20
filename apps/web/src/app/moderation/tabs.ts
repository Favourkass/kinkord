import { MODERATION_COPY } from "@/constants/moderation";
import { Routes } from "@/constants/Routes";
import type { ModerationTab } from "@/components/moderation/ModerationFrame";

export function moderationTabs(
  active:
    | "posts"
    | "groups"
    | "members"
    | "reports"
    | "payments"
    | "wallet"
    | "verification"
    | "blocklist"
    | "admins",
): ModerationTab[] {
  return [
    { label: "All posts", href: Routes.moderationPosts, active: active === "posts" },
    { label: "Groups", href: Routes.moderationGroups, active: active === "groups" },
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
      label: MODERATION_COPY.tabs.verification,
      href: Routes.moderationVerification,
      active: active === "verification",
    },
    {
      label: MODERATION_COPY.tabs.blocklist,
      href: Routes.moderationBlocklist,
      active: active === "blocklist",
    },
    {
      label: MODERATION_COPY.tabs.admins,
      href: Routes.moderationAdmins,
      active: active === "admins",
    },
  ];
}
