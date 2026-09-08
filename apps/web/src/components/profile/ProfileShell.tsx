import type { ReactNode } from "react";
import MobileTabBar from "@/components/app/MobileTabBar";
import type { AppNavLabels, AppNavLinks } from "@/components/app/nav";
import ProfileNavBar, { type ProfileNavBarProps } from "./ProfileNavBar";
import ProfileTopNav, { type ProfileTopNavProps } from "./ProfileTopNav";

export interface ProfileShellProps {
  nav: ProfileNavBarProps;
  topNav: ProfileTopNavProps;
  /** Mobile hero (cover, avatar, details, actions). */
  hero: ReactNode;
  /** Desktop left column card. */
  sideCard: ReactNode;
  /** Desktop right column. */
  aside: ReactNode;
  viewerAvatarUrl: string | null;
  links: AppNavLinks;
  labels: AppNavLabels;
  children: ReactNode;
}

/**
 * Public-profile chrome. Mobile (Figma 948:2866): nav bar + hero + tabs + icon tab bar.
 * Desktop (Figma 987:5468): top nav + three columns (340 / fluid / 300, gap 32).
 */
export default function ProfileShell({
  nav,
  topNav,
  hero,
  sideCard,
  aside,
  viewerAvatarUrl,
  links,
  labels,
  children,
}: ProfileShellProps) {
  return (
    <div className="min-h-dvh bg-pf-page text-pf-text">
      <div className="flex min-h-dvh flex-col lg:hidden">
        <ProfileNavBar {...nav} />
        <main className="flex-1 pb-[calc(57px+env(safe-area-inset-bottom))]">
          {hero}
          {children}
        </main>
        <MobileTabBar avatarUrl={viewerAvatarUrl} links={links} labels={labels} />
      </div>
      <div className="hidden min-h-dvh flex-col lg:flex">
        <ProfileTopNav {...topNav} />
        <main className="flex items-start gap-[32px] px-[32px] pb-[64px] pt-[32px]">
          <div className="w-[340px] shrink-0">{sideCard}</div>
          <div className="flex min-w-0 flex-1 flex-col gap-[24px]">{children}</div>
          <div className="flex w-[300px] shrink-0 flex-col gap-[24px]">{aside}</div>
        </main>
      </div>
    </div>
  );
}
