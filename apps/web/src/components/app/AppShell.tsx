import type { ReactNode } from "react";
import AppMobileHeader from "./AppMobileHeader";
import AvatarCircle from "./AvatarCircle";
import DesktopSidebar from "./DesktopSidebar";
import MobileTabBar, { type AppTab } from "./MobileTabBar";
import SidebarDrawer from "./SidebarDrawer";

export interface AppShellProps {
  brand: string;
  tagline: string;
  greeting: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  membersCount: string;
  activeTab: AppTab;
  activeNav: "home" | "profile" | "settings";
  drawerOpen: boolean;
  onMenu: () => void;
  onCloseDrawer: () => void;
  onLogout: () => void;
  messagesHref: string;
  profileHref: string;
  settingsHref: string;
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
  messagesHref,
  profileHref,
  settingsHref,
  children,
}: AppShellProps) {
  return (
    <div className="min-h-dvh bg-app-page">
      {/* Mobile */}
      <div className="flex min-h-dvh flex-col bg-app-surface lg:hidden">
        <AppMobileHeader brand={brand} tagline={tagline} greeting={greeting} onMenu={onMenu} />
        <main className="flex-1 pb-[130px] pt-[44px]">{children}</main>
        <MobileTabBar
          active={activeTab}
          avatarUrl={avatarUrl}
          messagesHref={messagesHref}
          profileHref={profileHref}
          settingsHref={settingsHref}
        />
        <SidebarDrawer
          open={drawerOpen}
          onClose={onCloseDrawer}
          name={name}
          handle={handle}
          avatarUrl={avatarUrl}
          membersLabel="Members"
          membersCount={membersCount}
          logoutLabel="Log Out"
          onLogout={onLogout}
        />
      </div>

      {/* Desktop */}
      <div className="hidden min-h-dvh lg:flex">
        <DesktopSidebar
          tagline={tagline}
          active={activeNav}
          profileHref={profileHref}
          settingsHref={settingsHref}
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
          <div className="pt-[56px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
