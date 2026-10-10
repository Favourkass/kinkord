import Link from "next/link";
import { ChevronDown, ChevronRight, LogOut, Settings } from "lucide-react";
import DrawerNavIcon from "./DrawerNavIcon";
import type { AppNav, DrawerNavItem, DrawerNavigation } from "./nav";

export interface AccountMenuProps {
  /** The phone drawer or the desktop sidebar; only the sizes differ. */
  variant: "drawer" | "sidebar";
  navigation: DrawerNavigation;
  membersCount: string;
  active?: AppNav;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  /** Called after a link is followed, e.g. to close the drawer. */
  onNavigate?: () => void;
  logoutLabel: string;
  onLogout: () => void;
}

const SIZES = {
  drawer: { row: "min-h-11 py-2.5 text-sm", icon: 17, button: "min-h-12 text-sm" },
  sidebar: { row: "min-h-10 py-2 text-[15px]", icon: 17, button: "min-h-11 text-[15px]" },
} as const;

function MenuLink({
  item,
  membersCount,
  current,
  soonLabel,
  rowClass,
  iconSize,
  onNavigate,
}: {
  item: DrawerNavItem;
  membersCount: string;
  current: boolean;
  soonLabel: string;
  rowClass: string;
  iconSize: number;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={current ? "page" : undefined}
      className={`flex items-center gap-3 border-b border-drawer-identity-border px-3 font-semibold last:border-b-0 ${rowClass} ${
        current ? "text-kink-gold-bright" : "text-drawer-text"
      }`}
    >
      <DrawerNavIcon icon={item.icon} size={iconSize} className="shrink-0 text-app-members-count" />
      <span>{item.label}</span>
      <span className="ml-auto flex items-center gap-2">
        {item.count === "members" ? (
          <span className="rounded-full bg-app-members px-2 py-0.5 text-[11px] font-black text-app-members-count">
            {membersCount}
          </span>
        ) : null}
        {item.soon ? (
          <span className="rounded-full bg-app-members px-2 py-0.5 text-[10px] font-bold uppercase text-app-members-count">
            {soonLabel}
          </span>
        ) : null}
        <ChevronRight aria-hidden="true" size={16} className="text-app-muted" />
      </span>
    </Link>
  );
}

/** The account menu shared by the phone drawer and the desktop sidebar. */
export default function AccountMenu({
  variant,
  navigation,
  membersCount,
  active,
  settingsOpen,
  onToggleSettings,
  onNavigate,
  logoutLabel,
  onLogout,
}: AccountMenuProps) {
  const size = SIZES[variant];
  const settingsId = `${variant}-settings-menu`;
  const link = (item: DrawerNavItem) => (
    <MenuLink
      key={item.key}
      item={item}
      membersCount={membersCount}
      current={Boolean(item.nav && item.nav === active)}
      soonLabel={navigation.soonLabel}
      rowClass={size.row}
      iconSize={size.icon}
      onNavigate={onNavigate}
    />
  );
  return (
    <>
      <nav
        aria-label={navigation.menuLabel}
        className="rounded-xl border border-drawer-identity-border"
      >
        {navigation.primary.map(link)}
      </nav>

      <button
        type="button"
        aria-expanded={settingsOpen}
        aria-controls={settingsId}
        onClick={onToggleSettings}
        className={`mt-3 flex w-full items-center gap-3 rounded-xl border px-3 text-left font-bold ${size.button} ${
          settingsOpen
            ? "border-app-members-count bg-drawer-settings text-app-members-count"
            : "border-drawer-identity-border text-drawer-text"
        }`}
      >
        <Settings aria-hidden="true" size={18} />
        <span>{navigation.settingsLabel}</span>
        {settingsOpen ? (
          <ChevronDown aria-hidden="true" size={17} className="ml-auto" />
        ) : (
          <ChevronRight aria-hidden="true" size={17} className="ml-auto" />
        )}
      </button>

      {settingsOpen ? (
        <nav
          id={settingsId}
          aria-label={navigation.settingsLabel}
          className="mt-2 rounded-xl border border-drawer-identity-border py-2"
        >
          {navigation.settingsGroups.map((group) => (
            <section key={group.label} className="pt-2 first:pt-0">
              <h2 className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-app-muted">
                {group.label}
              </h2>
              {group.items.map(link)}
            </section>
          ))}
        </nav>
      ) : null}

      <button
        type="button"
        onClick={onLogout}
        className={`mt-3 flex w-full items-center gap-3 rounded-xl border border-drawer-identity-border bg-drawer-settings px-3 font-bold text-app-logout-text ${size.button}`}
      >
        <LogOut aria-hidden="true" size={18} className="text-app-logout-icon" />
        {logoutLabel}
      </button>
    </>
  );
}
