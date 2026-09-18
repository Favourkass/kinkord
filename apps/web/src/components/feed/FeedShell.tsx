import type { ReactNode } from "react";
import AppMobileHeader from "@/components/app/AppMobileHeader";
import AvatarCircle from "@/components/app/AvatarCircle";
import DesktopSidebar from "@/components/app/DesktopSidebar";
import MobileTabBar from "@/components/app/MobileTabBar";
import type { AppNavLabels, AppNavLinks } from "@/components/app/nav";
import SidebarDrawer from "@/components/app/SidebarDrawer";

export interface FeedShellProps {
  brand: string;
  greeting: string;
  name: string;
  avatarUrl: string | null;
  membersCount: string;
  drawerOpen: boolean;
  onMenu: () => void;
  onCloseDrawer: () => void;
  onLogout: () => void;
  links: AppNavLinks;
  labels: AppNavLabels;
  /** Desktop right rail; hidden on a phone, where the feed carries it inline. Null on the list screens. */
  aside: ReactNode;
  children: ReactNode;
}

/**
 * Post-login chrome for the feed. Same furniture as `AppShell` — mobile header,
 * tab bar and drawer; desktop sidebar and greeting — but the content is written
 * once and the chrome switches responsively, rather than the screen being
 * rendered twice and one copy hidden. A feed of photos would otherwise fetch
 * every image in it twice.
 *
 * Desktop mirrors the mobile frames the design covers: the same column, 640px
 * wide beside the 333px sidebar, with the suggestions moved into a right rail
 * where there is finally room for one.
 */
export default function FeedShell({
  brand,
  greeting,
  name,
  avatarUrl,
  membersCount,
  drawerOpen,
  onMenu,
  onCloseDrawer,
  onLogout,
  links,
  labels,
  aside,
  children,
}: FeedShellProps) {
  return (
    <div className="min-h-dvh bg-app-page">
      <div className="lg:hidden">
        <AppMobileHeader brand={brand} onMenu={onMenu} />
      </div>

      <div className="flex min-h-dvh">
        <div className="hidden lg:block">
          <DesktopSidebar
            brand={brand}
            active="home"
            avatarUrl={avatarUrl}
            links={links}
            labels={labels}
            onLogout={onLogout}
          />
        </div>

        <main className="flex min-h-dvh min-w-0 flex-1 flex-col bg-app-surface pb-[calc(57px+env(safe-area-inset-bottom))] lg:pb-[64px]">
          <div className="hidden items-center gap-[23px] pl-[21px] pt-[17px] lg:flex">
            <AvatarCircle
              src={avatarUrl}
              alt={name}
              size={80}
              ringClassName="bg-kink-gold-bright"
            />
            <p className="text-[24px] font-normal text-app-text">{greeting}</p>
          </div>

          <div className="flex w-full justify-center gap-[32px] lg:px-[30px] lg:pt-[28px]">
            <div className="min-w-0 flex-1 lg:max-w-[640px]">{children}</div>
            {aside && (
              <aside className="hidden w-[300px] shrink-0 flex-col gap-[20px] lg:flex">
                {aside}
              </aside>
            )}
          </div>
        </main>
      </div>

      <div className="lg:hidden">
        <MobileTabBar active="home" avatarUrl={avatarUrl} links={links} labels={labels} />
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
    </div>
  );
}
