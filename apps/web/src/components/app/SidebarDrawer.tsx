import Link from "next/link";
import {
  BookOpenText,
  Bookmark,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Coins,
  Database,
  Gem,
  Info,
  Lock,
  LogOut,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import KycVerifiedMark from "@/components/brand/KycVerifiedMark";
import AvatarCircle from "./AvatarCircle";
import type { AppNavLabels, AppNavLinks, DrawerIcon, DrawerNavItem, DrawerNavigation } from "./nav";

export interface SidebarDrawerProps {
  open: boolean;
  onClose: () => void;
  name: string;
  avatarUrl: string | null;
  membersCount: string;
  kycVerified: boolean;
  links: Pick<AppNavLinks, "profile">;
  labels: Pick<AppNavLabels, "logout" | "profile">;
  navigation: DrawerNavigation;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  onLogout: () => void;
}

const icons: Record<DrawerIcon, LucideIcon> = {
  members: UsersRound,
  saved: Bookmark,
  kinkopedia: BookOpenText,
  verification: ShieldCheck,
  coins: Coins,
  subscription: Gem,
  marketplace: Store,
  account: UserRound,
  data: Database,
  privacy: Shield,
  security: Lock,
  content: SlidersHorizontal,
  safety: ShieldCheck,
  support: CircleHelp,
  about: Info,
};

function DrawerLink({
  item,
  membersCount,
  onNavigate,
}: {
  item: DrawerNavItem;
  membersCount: string;
  onNavigate: () => void;
}) {
  const Icon = icons[item.icon];
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className="flex min-h-11 items-center gap-3 border-b border-white/[0.08] px-3 py-2.5 text-sm font-semibold text-drawer-text last:border-b-0"
    >
      <Icon aria-hidden="true" size={17} className="shrink-0 text-kink-gold-bright" />
      <span>{item.label}</span>
      {item.count === "members" ? (
        <span className="ml-auto rounded-full bg-kink-gold-bright px-2 py-0.5 text-[11px] font-black text-black">
          {membersCount}
        </span>
      ) : null}
      <ChevronRight
        aria-hidden="true"
        size={16}
        className={item.count === "members" ? "text-neutral-500" : "ml-auto text-neutral-500"}
      />
    </Link>
  );
}

/** Mobile account/navigation drawer. Ordering and copy arrive display-ready from the shell presenter. */
export default function SidebarDrawer({
  open,
  onClose,
  name,
  avatarUrl,
  membersCount,
  kycVerified,
  links,
  labels,
  navigation,
  settingsOpen,
  onToggleSettings,
  onLogout,
}: SidebarDrawerProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30" role="dialog" aria-modal="true" aria-label="Menu">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/55"
      />
      <aside className="absolute inset-y-0 left-0 flex w-[348px] max-w-[92vw] flex-col overflow-y-auto border-r border-app-drawer-border bg-app-drawer px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(22px+env(safe-area-inset-top))]">
        <Link
          href={links.profile}
          onClick={onClose}
          aria-label={labels.profile}
          className="flex min-h-[58px] items-center gap-3 rounded-xl border border-kink-amber/25 bg-black/15 px-3 py-2"
        >
          <AvatarCircle src={avatarUrl} alt="" size={35} ringClassName="bg-kink-gold-bright" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[15px] font-bold text-drawer-text">
                {name || "My profile"}
              </span>
              {kycVerified ? <KycVerifiedMark size={14} /> : null}
            </span>
            <span className="block truncate text-[11px] text-app-subtle">View profile</span>
          </span>
          <ChevronRight aria-hidden="true" size={17} className="text-neutral-500" />
        </Link>

        <nav
          aria-label="Account menu"
          className="mt-3 rounded-xl border border-kink-amber/15 bg-black/15 px-1"
        >
          {navigation.primary.map((item) => (
            <DrawerLink
              key={item.key}
              item={item}
              membersCount={membersCount}
              onNavigate={onClose}
            />
          ))}
        </nav>

        <button
          type="button"
          aria-expanded={settingsOpen}
          aria-controls="drawer-settings-menu"
          onClick={onToggleSettings}
          className={`mt-3 flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-left text-sm font-bold ${settingsOpen ? "border-kink-gold-bright/60 bg-kink-amber/15 text-kink-gold-bright" : "border-kink-amber/25 bg-black/15 text-drawer-text"}`}
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
            id="drawer-settings-menu"
            aria-label="Settings and privacy"
            className="mt-2 rounded-xl border border-kink-amber/15 bg-black/15 px-3 py-2"
          >
            {navigation.settingsGroups.map((group) => (
              <section key={group.label} className="pt-2 first:pt-0">
                <h2 className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                  {group.label}
                </h2>
                {group.items.map((item) => (
                  <DrawerLink
                    key={item.key}
                    item={item}
                    membersCount={membersCount}
                    onNavigate={onClose}
                  />
                ))}
              </section>
            ))}
          </nav>
        ) : null}

        <button
          type="button"
          onClick={onLogout}
          className="mt-3 flex min-h-12 w-full items-center gap-3 rounded-xl border border-kink-amber/25 bg-kink-amber/10 px-3 text-sm font-bold text-drawer-text"
        >
          <LogOut aria-hidden="true" size={18} className="text-kink-gold-bright" />
          {labels.logout}
          <ChevronRight aria-hidden="true" size={17} className="ml-auto text-neutral-500" />
        </button>
      </aside>
    </div>
  );
}
