"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import VerifiedMark from "@/components/brand/VerifiedMark";
import AccountMenu from "./AccountMenu";
import AvatarCircle from "./AvatarCircle";
import type { AppNav, AppNavLabels, AppNavLinks, DrawerNavigation } from "./nav";

export interface SidebarDrawerProps {
  open: boolean;
  onClose: () => void;
  name: string;
  avatarUrl: string | null;
  membersCount: string;
  /** The identity-verified mark beside the name. */
  verified?: boolean;
  /** Whether Verification is listed: only while it's open to the member. */
  verificationEntry?: boolean;
  active?: AppNav;
  links: Pick<AppNavLinks, "profile">;
  labels: Pick<AppNavLabels, "logout" | "profile">;
  navigation: DrawerNavigation;
  onLogout: () => void;
}

/** Mobile slide-over: who you are, then the account menu. Copy and order come from the presenter. */
export default function SidebarDrawer({
  open,
  onClose,
  name,
  avatarUrl,
  membersCount,
  verified = false,
  verificationEntry = false,
  active,
  links,
  labels,
  navigation,
  onLogout,
}: SidebarDrawerProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  if (!open) return null;
  const menu = verificationEntry
    ? navigation
    : { ...navigation, primary: navigation.primary.filter((item) => !item.verification) };
  return (
    <div className="fixed inset-0 z-30" role="dialog" aria-modal="true" aria-label="Menu">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <aside className="absolute inset-y-0 left-0 flex w-[348px] max-w-[92vw] flex-col overflow-y-auto border-r border-app-drawer-border bg-app-drawer px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(22px+env(safe-area-inset-top))]">
        <Link
          href={links.profile}
          onClick={onClose}
          className="mb-3 flex min-h-[58px] items-center gap-3 rounded-xl border border-drawer-identity-border px-3 py-2"
        >
          <AvatarCircle src={avatarUrl} alt="" size={35} ringClassName="bg-kink-gold-bright" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[15px] font-bold text-drawer-text">
                {name || labels.profile}
              </span>
              {verified ? (
                <>
                  <VerifiedMark size={14} />
                  <span className="sr-only">{navigation.verifiedLabel}</span>
                </>
              ) : null}
            </span>
            <span className="block truncate text-[11px] text-app-subtle">
              {navigation.viewProfileLabel}
            </span>
          </span>
          <ChevronRight aria-hidden="true" size={17} className="text-app-muted" />
        </Link>
        <AccountMenu
          navigation={menu}
          membersCount={membersCount}
          active={active}
          settingsOpen={settingsOpen}
          onToggleSettings={() => setSettingsOpen((wasOpen) => !wasOpen)}
          onNavigate={onClose}
          logoutLabel={labels.logout}
          onLogout={onLogout}
        />
      </aside>
    </div>
  );
}
