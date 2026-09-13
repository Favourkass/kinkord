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
  /** Page background; the members directory screens use the Figma `mem-page` tone. */
  mobileTone?: "surface" | "members";
  /** Desktop greeting strip (avatar + "Hi …"); the directory screens don't have one in the PC frames. */
  desktopGreeting?: boolean;
  /** Replaces the hamburger header on mobile (e.g. the Edit Profile back-arrow NavBar). */
  mobileHeader?: ReactNode;
  children: ReactNode;
}

/** Post-login chrome: compact mobile header / icon tab bar / drawer, desktop sidebar + panel. */
export default function AppShell({
  brand,
  greeting,
  name,
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
  mobileTone = "surface",
  desktopGreeting = true,
  mobileHeader,
  children,
}: AppShellProps) {
  const tone = mobileTone === "members" ? "bg-mem-page" : "bg-app-surface";
  return (
    <div className="min-h-dvh bg-app-page">
      {/* Mobile */}
      <div className={`flex min-h-dvh flex-col lg:hidden ${tone}`}>
        {mobileHeader ?? <AppMobileHeader brand={brand} onMenu={onMenu} />}
        <main className="flex flex-1 flex-col pb-[calc(57px+env(safe-area-inset-bottom))]">
          {children}
        </main>
        <MobileTabBar active={activeTab} avatarUrl={avatarUrl} links={links} labels={labels} />
        <SidebarDrawer
          open={drawerOpen}
          onClose={onCloseDrawer}
          name={name}
          avatarUrl={avatarUrl}
          membersCount={membersCount}
          links={links}
          labels={labels}
          onLogout={onLogout}
        />
      </div>

      {/* Desktop (Figma "PC" frames: 333px sidebar, content column from x=363) */}
      <div className="hidden min-h-dvh lg:flex">
        <DesktopSidebar
          brand={brand}
          active={activeNav}
          avatarUrl={avatarUrl}
          links={links}
          labels={labels}
          onLogout={onLogout}
        />
        <main className={`flex min-h-dvh min-w-0 flex-1 flex-col ${tone}`}>
          {desktopGreeting && (
            <div className="flex items-center gap-[23px] pl-[21px] pt-[17px]">
              <AvatarCircle
                src={avatarUrl}
                alt={name}
                size={80}
                ringClassName="bg-kink-gold-bright"
              />
              <p className="text-[24px] font-normal text-app-text">{greeting}</p>
            </div>
          )}
          <div className={`flex flex-1 flex-col ${desktopGreeting ? "pt-[40px]" : "px-[30px]"}`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
