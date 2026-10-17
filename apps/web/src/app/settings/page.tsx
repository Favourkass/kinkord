"use client";

import Link from "next/link";
import AppShell from "@/components/app/AppShell";
import { ChevronRightIcon } from "@/components/app/icons";
import PushSettingRow from "@/components/app/PushSettingRow";
import { Routes } from "@/constants/Routes";
import { MODERATION_COPY } from "@/constants/moderation";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { useAdminAccessPresenter } from "@/presenters/useAdminAccessPresenter";
import { useHomePresenter } from "@/presenters/useHomePresenter";
import { usePushPresenter } from "@/presenters/usePushPresenter";
import { usePwaPresenter } from "@/presenters/usePwaPresenter";
import { useVerificationAvailabilityPresenter } from "@/presenters/useVerificationAvailabilityPresenter";

export default function SettingsPage() {
  const vm = useHomePresenter();
  const pwa = usePwaPresenter();
  const push = usePushPresenter();
  const admin = useAdminAccessPresenter();
  const nav = getAppShellNav();
  const verification = useVerificationAvailabilityPresenter();
  return (
    <AppShell
      brand="KINKORD"
      tagline="THE WORLD'S KINK COMMUNITY"
      greeting={vm.greeting}
      name={vm.name}
      handle={vm.handle}
      avatarUrl={vm.avatarUrl}
      membersCount={vm.membersCount}
      notificationsUnread={vm.notificationsUnread}
      notificationsCount={vm.notificationsCount}
      messagesCount={vm.messagesCount}
      activeNav="settings"
      drawerOpen={vm.drawerOpen}
      onMenu={vm.openDrawer}
      onCloseDrawer={vm.closeDrawer}
      onLogout={vm.logout}
      links={nav.links}
      labels={nav.labels}
      drawerNavigation={nav.drawer}
      verificationEntry={vm.verificationEntry}
    >
      <div className="mx-auto w-full max-w-[440px] px-[29px]">
        <h1 className="text-[24px] font-medium text-app-value">Settings</h1>
        <p className="pt-[28px] pb-[8px] text-[14px] font-bold text-app-text">Application</p>
        <button
          type="button"
          onClick={pwa.downloadApp}
          className="flex h-[52px] w-full items-center justify-between rounded-[16px] bg-app-members px-[18px] text-[18px] font-medium text-app-name cursor-pointer"
        >
          <span>{pwa.isInstalled ? "App Installed" : "Download / Install App"}</span>
          <ChevronRightIcon className="text-[#b8850f]" />
        </button>
        <PushSettingRow {...push.settings} />
        <p className="pt-[28px] pb-[8px] text-[14px] font-bold text-app-text">Account</p>
        <Link
          href={Routes.profileEdit}
          className="flex h-[52px] items-center justify-between rounded-[16px] bg-app-members px-[18px] text-[18px] font-medium text-app-name"
        >
          Edit profile
          <ChevronRightIcon className="text-[#b8850f]" />
        </Link>
        <Link
          href={Routes.subscription}
          className="mt-[12px] flex h-[52px] items-center justify-between rounded-[16px] bg-app-members px-[18px] text-[18px] font-medium text-app-name"
        >
          {nav.labels.subscription}
          <ChevronRightIcon className="text-[#b8850f]" />
        </Link>
        <Link
          href={Routes.settingsSecurity}
          className="mt-[12px] flex h-[52px] items-center justify-between rounded-[16px] bg-app-members px-[18px] text-[18px] font-medium text-app-name"
        >
          Security &amp; 2FA
          <ChevronRightIcon className="text-[#b8850f]" />
        </Link>
        {verification.showEntry ? (
          <Link
            href={Routes.settingsVerification}
            className="mt-[12px] flex h-[52px] items-center justify-between rounded-[16px] bg-app-members px-[18px] text-[18px] font-medium text-app-name"
          >
            Verification
            <ChevronRightIcon className="text-[#b8850f]" />
          </Link>
        ) : null}
        {admin.isAdmin ? (
          <Link
            href={Routes.moderation}
            className="mt-[12px] flex h-[52px] items-center justify-between rounded-[16px] bg-app-members px-[18px] text-[18px] font-medium text-app-name"
          >
            {MODERATION_COPY.settingsEntry}
            <ChevronRightIcon className="text-[#b8850f]" />
          </Link>
        ) : null}
      </div>
    </AppShell>
  );
}
