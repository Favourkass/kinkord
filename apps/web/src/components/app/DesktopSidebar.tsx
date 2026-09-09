import Link from "next/link";
import AvatarCircle from "./AvatarCircle";
import MaskIcon, { type MaskIconName } from "./MaskIcon";
import type { AppNav, AppNavLabels, AppNavLinks } from "./nav";

export interface DesktopSidebarProps {
  brand: string;
  active: AppNav;
  avatarUrl: string | null;
  links: AppNavLinks;
  labels: AppNavLabels;
  onLogout: () => void;
}

/**
 * Desktop sidebar per the Figma "PC" frames (881:799 dark / 881:849 light): 333px
 * panel, 48px gold wordmark, Home / Chat / Notifications / Profile, then a divider
 * with "Settings and Privacy" and "Log Out" pinned to the bottom.
 */
export default function DesktopSidebar({
  brand,
  active,
  avatarUrl,
  links,
  labels,
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
    <aside className="sticky top-0 flex h-dvh w-[333px] shrink-0 flex-col bg-side-bg pb-[49px] pt-[37px]">
      <p className="pl-[38px] text-[48px] font-extrabold leading-[47px] tracking-[4.8px] text-kink-gold-bright">
        {brand}
      </p>
      <nav className="mt-[46px] flex flex-col gap-[27px]">
        {items.map((item) => (
          <Link
            key={item.key}
            href={links[item.key]}
            aria-current={active === item.key ? "page" : undefined}
            className={row(active === item.key)}
          >
            <span className={`grid size-[29px] place-items-center ${item.iconClass}`}>
              <MaskIcon
                name={item.icon}
                width={29}
                height={item.icon === "bell-outline" ? 29 : 29}
              />
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
      <div className="mt-auto">
        <div className="ml-[7px] w-[307px] border-t-[1.5px] border-side-divider" />
        <Link
          href={links.settings}
          aria-current={active === "settings" ? "page" : undefined}
          className={`mt-[28px] ${row(active === "settings")}`}
        >
          <span className="grid size-[29px] place-items-center text-side-text">
            <MaskIcon name="settings" width={29} />
          </span>
          {labels.settings}
        </Link>
        <button type="button" onClick={onLogout} className={`mt-[24px] ${row(false)}`}>
          <span className="grid size-[29px] place-items-center text-side-text">
            <MaskIcon name="logout" width={29} />
          </span>
          {labels.logout}
        </button>
      </div>
    </aside>
  );
}
