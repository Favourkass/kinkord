import { MODERATION_COPY } from "@/constants/moderation";
import { Routes } from "@/constants/Routes";
import type { ModerationTab } from "@/components/moderation/ModerationFrame";

export function moderationTabs(
  active:
    | "posts"
    | "members"
    | "reports"
    | "payments"
    | "wallet"
    | "verification"
    | "blocklist"
    | "location"
    | "kink-rings"
    | "silver"
    | "team-page"
    | "admins",
): ModerationTab[] {
  return [
    { label: "All posts", href: Routes.moderationPosts, active: active === "posts" },
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
      label: MODERATION_COPY.tabs.location,
      href: Routes.moderationLocation,
      active: active === "location",
    },
    {
      label: MODERATION_COPY.tabs.silver,
      href: Routes.moderationSilver,
      active: active === "silver",
    },
    {
      label: MODERATION_COPY.tabs.kinkRings,
      href: Routes.moderationKinkRings,
      active: active === "kink-rings",
    },
    {
      label: MODERATION_COPY.tabs.teamPage,
      href: Routes.moderationTeamPage,
      active: active === "team-page",
    },
    {
      label: MODERATION_COPY.tabs.admins,
      href: Routes.moderationAdmins,
      active: active === "admins",
    },
  ];
}
