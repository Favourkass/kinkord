"use client";

import Link from "next/link";
import { ChevronLeft, Menu } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import KinkCoinsWithdrawView from "@/components/kinkcoins/KinkCoinsWithdrawView";
import { Routes } from "@/constants/Routes";
import { appShellProps, getAppShellNav } from "@/presenters/getAppShellNav";
import { useKinkCoinsWithdrawPresenter } from "@/presenters/useKinkCoinsWithdrawPresenter";
import { useHomePresenter } from "@/presenters/useHomePresenter";

export default function KinkCoinsWithdrawPage() {
  const home = useHomePresenter();
  const nav = getAppShellNav();
  const vm = useKinkCoinsWithdrawPresenter();
  return (
    <AppShell
      {...appShellProps(home, nav)}
      activeNav="kinkcoins"
      desktopGreeting={false}
      mobileHeader={
        <header className="flex h-14 items-center gap-4 border-b border-app-card-border bg-app-surface px-4 text-app-text">
          {vm.step === "options" ? (
            <Link
              href={Routes.kinkcoins}
              aria-label={vm.copy.back}
              className="text-app-members-count"
            >
              <ChevronLeft size={22} />
            </Link>
          ) : (
            <button
              type="button"
              onClick={vm.onBack}
              aria-label={vm.copy.backOptions}
              className="text-app-members-count"
            >
              <ChevronLeft size={22} />
            </button>
          )}
          <h1 className="flex-1 text-sm font-semibold">{vm.title}</h1>
          <button
            type="button"
            onClick={home.openDrawer}
            aria-label={vm.copy.menu}
            className="text-app-members-count"
          >
            <Menu size={21} />
          </button>
        </header>
      }
    >
      <h1 className="mx-auto hidden w-full max-w-[600px] px-5 pb-5 pt-8 text-xl font-semibold text-app-text lg:block">
        {vm.title}
      </h1>
      <KinkCoinsWithdrawView vm={vm} />
    </AppShell>
  );
}
