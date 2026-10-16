import Link from "next/link";
import { ChevronDown, ChevronRight, LogOut, Settings } from "lucide-react";
import DrawerNavIcon from "./DrawerNavIcon";
import type { AppNav, DrawerNavItem, DrawerNavigation } from "./nav";

export interface AccountMenuProps {
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

function MenuLink({
  item,
  membersCount,
  current,
  soonLabel,
  onNavigate,
}: {
  item: DrawerNavItem;
  membersCount: string;
  current: boolean;
  soonLabel: string;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={current ? "page" : undefined}
      className={`flex min-h-11 items-center gap-3 border-b border-drawer-identity-border px-3 py-2.5 text-sm font-semibold last:border-b-0 ${
        current ? "text-kink-gold-bright" : "text-drawer-text"
      }`}
    >
      <DrawerNavIcon icon={item.icon} size={17} className="shrink-0 text-app-members-count" />
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

/** The phone drawer's account menu: the main entries, Settings & Privacy (expands), Log Out. */
export default function AccountMenu({
  navigation,
  membersCount,
  active,
  settingsOpen,
  onToggleSettings,
  onNavigate,
  logoutLabel,
  onLogout,
}: AccountMenuProps) {
  const settingsId = "drawer-settings-menu";
  const link = (item: DrawerNavItem) => (
    <MenuLink
      key={item.key}
      item={item}
      membersCount={membersCount}
      current={Boolean(item.nav && item.nav === active)}
      soonLabel={navigation.soonLabel}
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
        className={`mt-3 flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-left text-sm font-bold ${
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
        className="mt-3 flex min-h-12 w-full items-center gap-3 rounded-xl border border-drawer-identity-border bg-drawer-settings px-3 text-sm font-bold text-app-logout-text"
      >
        <LogOut aria-hidden="true" size={18} className="text-app-logout-icon" />
        {logoutLabel}
      </button>
    </>
  );
}
