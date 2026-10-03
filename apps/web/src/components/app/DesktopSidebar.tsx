import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import AvatarCircle from "./AvatarCircle";
import DrawerNavIcon from "./DrawerNavIcon";
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
        <div className="border-t-[1.5px] border-side-divider" />
        <nav aria-label="Desktop account menu" className="mt-4 rounded-xl bg-black/10 px-2">
          {navigation.primary.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="flex min-h-10 items-center gap-3 border-b border-white/[0.07] px-2 py-2 text-[15px] font-semibold text-side-text last:border-b-0"
            >
              <DrawerNavIcon
                icon={item.icon}
                size={17}
                className="shrink-0 text-kink-gold-bright"
              />
              <span>{item.label}</span>
              {item.count === "members" ? (
                <span className="ml-auto rounded-full bg-kink-gold-bright px-2 py-0.5 text-[10px] font-black text-black">
                  {membersCount}
                </span>
              ) : null}
              <ChevronRight
                aria-hidden="true"
                size={15}
                className={
                  item.count === "members" ? "text-neutral-500" : "ml-auto text-neutral-500"
                }
              />
            </Link>
          ))}
        </nav>
        <button
          type="button"
          aria-expanded={settingsOpen}
          aria-controls="desktop-settings-menu"
          onClick={onToggleSettings}
          className={`mt-3 flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 text-left text-[15px] font-bold ${settingsOpen ? "border-kink-gold-bright/60 bg-kink-amber/15 text-kink-gold-bright" : "border-kink-amber/25 bg-black/10 text-side-text"}`}
        >
          <MaskIcon name="settings" width={18} />
          <span>{navigation.settingsLabel}</span>
          {settingsOpen ? (
            <ChevronDown aria-hidden="true" size={16} className="ml-auto" />
          ) : (
            <ChevronRight aria-hidden="true" size={16} className="ml-auto" />
          )}
        </button>
        {settingsOpen ? (
          <nav
            id="desktop-settings-menu"
            aria-label="Desktop settings and privacy"
            className="mt-2 rounded-xl bg-black/10 px-3 py-2"
          >
            {navigation.settingsGroups.map((group) => (
              <section key={group.label} className="pt-2 first:pt-0">
                <h2 className="pb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                  {group.label}
                </h2>
                {group.items.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className="flex min-h-9 items-center gap-2 border-b border-white/[0.06] py-1.5 text-[13px] font-semibold text-side-text last:border-b-0"
                  >
                    <DrawerNavIcon icon={item.icon} size={15} className="text-kink-gold-bright" />
                    <span>{item.label}</span>
                    <ChevronRight
                      aria-hidden="true"
                      size={14}
                      className="ml-auto text-neutral-500"
                    />
                  </Link>
                ))}
              </section>
            ))}
          </nav>
        ) : null}
        <button
          type="button"
          onClick={onLogout}
          className="mt-3 flex min-h-11 w-full items-center gap-3 rounded-xl border border-kink-amber/25 bg-kink-amber/10 px-3 text-[15px] font-bold text-side-text"
        >
          <span className="grid size-[29px] place-items-center text-side-text">
            <MaskIcon name="logout" width={18} />
          </span>
          {labels.logout}
          <ChevronRight aria-hidden="true" size={15} className="ml-auto text-neutral-500" />
        </button>
      </div>
    </aside>
  );
}
