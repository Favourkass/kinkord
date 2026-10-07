"use client";
import Link from "next/link";
import { ChevronLeft, Menu } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import WalletView from "@/components/kinkcoins/WalletView";
import type { WalletMode } from "@/domain/wallet";
import { appShellProps, getAppShellNav } from "@/presenters/getAppShellNav";
import { useHomePresenter } from "@/presenters/useHomePresenter";
import { useWalletPresenter } from "@/presenters/useWalletPresenter";
export default function WalletScreen({
  mode,
  paymentId,
}: {
  mode: WalletMode;
  paymentId?: string;
}) {
  const home = useHomePresenter(),
    nav = getAppShellNav(),
    vm = useWalletPresenter(mode, paymentId);
  return (
    <AppShell
      {...appShellProps(home, nav)}
      activeNav="kinkcoins"
      desktopGreeting={false}
      mobileHeader={
        mode === "banks" ? (
          <header className="relative flex min-h-24 items-start justify-center px-12 pb-2 pt-4 text-center text-app-text">
            <Link
              href={vm.walletHref}
              aria-label={vm.copy.back}
              className="absolute left-5 top-5 text-app-members-count"
            >
              <ChevronLeft size={28} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-app-members-count">{vm.title}</h1>
              <p className="mt-2 text-xs text-app-subtle">{vm.copy.banksSubtitle}</p>
            </div>
          </header>
        ) : (
          <header className="flex h-14 items-center gap-4 border-b border-app-card-border bg-app-surface px-4 text-app-text">
            <Link
              href={mode === "overview" ? vm.homeHref : vm.walletHref}
              aria-label={vm.copy.back}
              className="text-app-members-count"
            >
              <ChevronLeft size={22} />
            </Link>
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
        )
      }
    >
      {mode === "banks" ? (
        <div className="hidden pt-8 text-center lg:block">
          <h1 className="text-3xl font-bold text-app-members-count">{vm.title}</h1>
          <p className="mt-2 text-sm text-app-subtle">{vm.copy.banksSubtitle}</p>
        </div>
      ) : (
        <h1 className="mx-auto hidden w-full max-w-[600px] px-5 pb-5 pt-8 text-xl font-semibold text-app-text lg:block">
          {vm.title}
        </h1>
      )}
      <WalletView vm={vm} />
    </AppShell>
  );
}
