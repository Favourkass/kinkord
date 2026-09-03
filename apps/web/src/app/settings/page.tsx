"use client";

import { useState } from "react";
import Link from "next/link";
import AppShell from "@/components/app/AppShell";
import { ChevronRightIcon } from "@/components/app/icons";
import { Routes } from "@/constants/Routes";
import { useHomePresenter } from "@/presenters/useHomePresenter";
import { usePwaPresenter } from "@/presenters/usePwaPresenter";
import { getTheme, setTheme, type Theme } from "@/util/theme";

export default function SettingsPage() {
  const vm = useHomePresenter();
  const pwa = usePwaPresenter();
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof document === "undefined" ? "light" : getTheme(),
  );

  const choose = (next: Theme) => {
    setTheme(next);
    setThemeState(next);
  };

  const chip = (value: Theme, label: string) => (
    <button
      type="button"
      suppressHydrationWarning
      onClick={() => choose(value)}
      className={`h-[41px] flex-1 rounded-[10px] border text-[15px] font-bold ${
        theme === value
          ? "border-kink-amber bg-kink-amber text-black"
          : "border-app-input-border bg-app-input text-app-value"
      }`}
    >
      {label}
    </button>
  );

  return (
    <AppShell
      brand="KINKORD"
      tagline="THE WORLD'S KINK COMMUNITY"
      greeting={vm.greeting}
      name={vm.name}
      handle={vm.handle}
      avatarUrl={vm.avatarUrl}
      membersCount={vm.membersCount}
      activeTab="settings"
      activeNav="settings"
      drawerOpen={vm.drawerOpen}
      onMenu={vm.openDrawer}
      onCloseDrawer={vm.closeDrawer}
      onLogout={vm.logout}
      messagesHref={Routes.messages}
      profileHref={Routes.profile}
      settingsHref={Routes.settings}
    >
      <div className="mx-auto w-full max-w-[440px] px-[29px]">
        <h1 className="text-[24px] font-medium text-app-value">Settings</h1>
        <p className="pt-[24px] pb-[8px] text-[14px] font-bold text-app-text">Appearance</p>
        <div className="flex gap-[12px]">
          {chip("light", "Light")}
          {chip("dark", "Dark")}
        </div>
        <p className="pt-[28px] pb-[8px] text-[14px] font-bold text-app-text">Application</p>
        <button
          type="button"
          onClick={pwa.downloadApp}
          className="flex h-[52px] w-full items-center justify-between rounded-[16px] bg-app-members px-[18px] text-[18px] font-medium text-app-name cursor-pointer"
        >
          <span>{pwa.isInstalled ? "App Installed" : "Download / Install App"}</span>
          <ChevronRightIcon className="text-[#b8850f]" />
        </button>
        <p className="pt-[28px] pb-[8px] text-[14px] font-bold text-app-text">Account</p>
        <Link
          href={Routes.profileEdit}
          className="flex h-[52px] items-center justify-between rounded-[16px] bg-app-members px-[18px] text-[18px] font-medium text-app-name"
        >
          Edit profile
          <ChevronRightIcon className="text-[#b8850f]" />
        </Link>
        <Link
          href={Routes.profile}
          className="mt-[12px] flex h-[52px] items-center justify-between rounded-[16px] bg-app-members px-[18px] text-[18px] font-medium text-app-name"
        >
          Security &amp; 2FA
          <ChevronRightIcon className="text-[#b8850f]" />
        </Link>
      </div>
    </AppShell>
  );
}
