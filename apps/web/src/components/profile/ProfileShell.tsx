import type { ReactNode } from "react";
import MobileTabBar from "@/components/app/MobileTabBar";
import type { AppNavLabels, AppNavLinks, AppTab } from "@/components/app/nav";
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
  /** "profile" on your own profile so the avatar tab lights up; undefined elsewhere. */
  activeTab?: AppTab;
  links: AppNavLinks;
  labels: AppNavLabels;
  children: ReactNode;
}

/**
 * Public-profile chrome. Mobile (Figma 948:2866): nav bar + hero + tabs + icon tab bar.
 * Desktop (Figma 987:5468): top nav + three columns (340 / fluid / 300, gap 32).
 *
 * The chrome switches responsively but the tabs are written once, rather than
 * the screen being rendered twice with one copy hidden — now that the Posts tab
 * carries photos, a second hidden copy would fetch every one of them again.
 */
export default function ProfileShell({
  nav,
  topNav,
  hero,
  sideCard,
  aside,
  viewerAvatarUrl,
  activeTab,
  links,
  labels,
  children,
}: ProfileShellProps) {
  return (
    <div className="min-h-dvh bg-pf-page text-pf-text">
      <div className="lg:hidden">
        <ProfileNavBar {...nav} />
      </div>
      <div className="hidden lg:block">
        <ProfileTopNav {...topNav} />
      </div>

      <main className="pb-[calc(57px+env(safe-area-inset-bottom))] lg:flex lg:items-start lg:gap-[32px] lg:px-[32px] lg:pb-[64px] lg:pt-[32px]">
        <div className="hidden w-[340px] shrink-0 lg:block">{sideCard}</div>
        <div className="flex min-w-0 flex-1 flex-col lg:gap-[24px]">
          <div className="lg:hidden">{hero}</div>
          {children}
        </div>
        <div className="hidden w-[300px] shrink-0 flex-col gap-[24px] lg:flex">{aside}</div>
      </main>

      <div className="lg:hidden">
        <MobileTabBar
          active={activeTab}
          avatarUrl={viewerAvatarUrl}
          links={links}
          labels={labels}
        />
      </div>
    </div>
  );
}
