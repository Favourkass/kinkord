import Link from "next/link";
import AccountMenu from "./AccountMenu";
import AvatarCircle from "./AvatarCircle";
import MaskIcon, { type MaskIconName } from "./MaskIcon";
import type { AppNav, AppNavLabels, AppNavLinks, DrawerNavigation } from "./nav";

export interface DesktopSidebarProps {
  brand: string;
  active: AppNav;
  notificationsUnread?: boolean;
  avatarUrl: string | null;
  membersCount: string;
  links: AppNavLinks;
  labels: AppNavLabels;
  navigation: DrawerNavigation;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  onLogout: () => void;
}

/**
 * Desktop sidebar per the Figma "PC" frames (881:799 dark / 881:849 light): 333px
 * panel with the core navigation followed by the client-approved account menu.
 * Settings children remain behind the same explicit accordion used on mobile.
 */
export default function DesktopSidebar({
  brand,
  active,
  notificationsUnread,
  avatarUrl,
  membersCount,
  links,
  labels,
  navigation,
  settingsOpen,
  onToggleSettings,
  onLogout,
}: DesktopSidebarProps) {
  const items: Array<{
    key: "home" | "chat" | "notifications";
    icon: MaskIconName;
    iconClass: string;
  }> = [
    { key: "home", icon: "home-solid", iconClass: "text-kink-amber" },
    { key: "chat", icon: "chat", iconClass: "text-side-text" },
    { key: "notifications", icon: "bell-outline", iconClass: "text-side-text" },
  ];
  const row = (isActive: boolean) =>
    `flex h-[29px] items-center gap-[17px] pl-[38px] text-[22px] font-medium leading-none ${
      isActive ? "text-kink-gold-bright" : "text-side-text"
    }`;
  return (
    <aside className="sticky top-0 flex h-dvh w-[333px] shrink-0 flex-col overflow-y-auto bg-side-bg pb-[32px] pt-[37px]">
      <p className="pl-[38px] text-[48px] font-extrabold leading-[47px] tracking-[4.8px] text-kink-gold-bright">
        {brand}
      </p>
      <nav className="mt-[46px] flex flex-col gap-[27px]">
        {items.map((item) => (
          <Link
            key={item.key}
            href={links[item.key]}
            aria-label={
              item.key === "notifications" && notificationsUnread
                ? `${labels[item.key]}, unread notifications`
                : undefined
            }
            aria-current={active === item.key ? "page" : undefined}
            className={row(active === item.key)}
          >
            <span className={`relative grid size-[29px] place-items-center ${item.iconClass}`}>
              <MaskIcon
                name={item.icon}
                width={29}
                height={item.icon === "bell-outline" ? 29 : 29}
              />
              {item.key === "notifications" && notificationsUnread && (
                <span
                  aria-hidden
                  className="absolute -right-1 -top-1 size-2 rounded-full bg-app-members-count ring-2 ring-side-bg"
                />
              )}
            </span>
            {labels[item.key]}
          </Link>
        ))}
        <Link
          href={links.profile}
          aria-current={active === "profile" || active === "edit-profile" ? "page" : undefined}
          className={row(active === "profile" || active === "edit-profile")}
        >
          <span className="grid size-[29px] place-items-center">
            <AvatarCircle src={avatarUrl} alt="" size={24} ringClassName="bg-kink-gold-bright" />
          </span>
          {labels.profile}
        </Link>
      </nav>
      <div className="mt-[34px] px-[20px]">
        <div className="mb-4 border-t-[1.5px] border-side-divider" />
        <AccountMenu
          variant="sidebar"
          navigation={navigation}
          membersCount={membersCount}
          active={active}
          settingsOpen={settingsOpen}
          onToggleSettings={onToggleSettings}
          logoutLabel={labels.logout}
          onLogout={onLogout}
        />
      </div>
    </aside>
  );
}
