import type { ReactNode } from "react";
import AppMobileHeader from "./AppMobileHeader";
import AvatarCircle from "./AvatarCircle";
import DesktopSidebar from "./DesktopSidebar";
import MobileTabBar from "./MobileTabBar";
import type { AppNav, AppNavLabels, AppNavLinks, AppTab } from "./nav";
import SidebarDrawer from "./SidebarDrawer";

export type { AppNav, AppNavLabels, AppNavLinks, AppTab } from "./nav";

export interface AppShellProps {
  brand: string;
  tagline: string;
  greeting: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  membersCount: string;
  /** Highlighted bottom tab; omit on screens outside the tab bar (e.g. Settings). */
  activeTab?: AppTab;
  activeNav: AppNav;
  drawerOpen: boolean;
  onMenu: () => void;
  onCloseDrawer: () => void;
  onLogout: () => void;
  links: AppNavLinks;
  labels: AppNavLabels;
  children: ReactNode;
}

/** Post-login chrome: mobile header/tab-bar/drawer, desktop sidebar + panel. */
export default function AppShell({
  brand,
  tagline,
  greeting,
  name,
  handle,
  avatarUrl,
  membersCount,
  activeTab,
  activeNav,
  drawerOpen,
  onMenu,
  onCloseDrawer,
  onLogout,
  links,
  labels,
  children,
}: AppShellProps) {
  return (
    <div className="min-h-dvh bg-app-page">
      {/* Mobile */}
      <div className="flex min-h-dvh flex-col bg-app-surface lg:hidden">
        <AppMobileHeader brand={brand} tagline={tagline} greeting={greeting} onMenu={onMenu} />
        <main className="flex-1 pb-[110px] pt-[24px]">{children}</main>
        <MobileTabBar active={activeTab} avatarUrl={avatarUrl} links={links} labels={labels} />
        <SidebarDrawer
          open={drawerOpen}
          onClose={onCloseDrawer}
          name={name}
          handle={handle}
          avatarUrl={avatarUrl}
          membersCount={membersCount}
          links={links}
          labels={labels}
          onLogout={onLogout}
        />
      </div>

      {/* Desktop */}
      <div className="hidden min-h-dvh lg:flex">
        <DesktopSidebar
          tagline={tagline}
          active={activeNav}
          links={links}
          labels={labels}
          onLogout={onLogout}
        />
        <main className="min-h-dvh flex-1 rounded-[40px] bg-app-surface">
          <div className="flex items-center gap-[23px] pl-[21px] pt-[17px]">
            <AvatarCircle
              src={avatarUrl}
              alt={name}
              size={80}
              ringClassName="bg-kink-gold-bright"
            />
            <p className="text-[24px] font-normal text-app-text">{greeting}</p>
          </div>
          <div className="pt-[40px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
