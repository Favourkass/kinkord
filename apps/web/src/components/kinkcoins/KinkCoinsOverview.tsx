import Link from "next/link";
import { ArrowLeftRight, ChevronRight, Coins, Gift, ScrollText, Wallet } from "lucide-react";
import type { getKinkCoinsOverviewVM } from "@/presenters/getKinkCoinsVM";
import CoinMedallion from "./CoinMedallion";

const icons = {
  buy: Coins,
  earn: Gift,
  history: ScrollText,
  convert: ArrowLeftRight,
  withdraw: Wallet,
};

export default function KinkCoinsOverview({
  vm,
}: {
  vm: ReturnType<typeof getKinkCoinsOverviewVM>;
}) {
  return (
    <div className="mx-auto w-full max-w-[600px] px-5 pb-8 text-app-text">
      <section className="relative overflow-hidden pb-2 pt-5 text-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-32 top-8 h-64 w-64 rounded-full border border-kink-gold-bright/20"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full border border-kink-gold-bright/20"
        />
        <div className="relative mx-auto flex h-24 w-48 items-end justify-center">
          <CoinMedallion kind="star" className="absolute bottom-1 left-1 size-14 text-sm" />
          <CoinMedallion kind="crown" className="absolute bottom-1 right-1 size-14 text-sm" />
          <CoinMedallion kind="coin" className="relative z-10 size-24 text-2xl" />
        </div>
        <h2 className="mt-4 text-[30px] font-bold text-app-members-count">{vm.copy.heading}</h2>
        <p className="mx-auto mt-1 max-w-[330px] text-xs leading-relaxed text-app-subtle">
          {vm.copy.description}
        </p>
      </section>
      <section className="mt-1 rounded-lg border border-[#8d722d] bg-[linear-gradient(145deg,var(--app-card),var(--app-surface))] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-app-subtle">
          <h3 className="uppercase">{vm.copy.balance}</h3>
          <span>{vm.copy.preview}</span>
        </div>
        <div className="mt-3 grid grid-cols-3 divide-x divide-app-card-border text-center">
          {vm.balances.map((balance) => (
            <div key={balance.kind} className="flex flex-col items-center gap-1">
              <CoinMedallion kind={balance.kind} className="size-7 border text-[8px]" />
              <span className="text-xs text-app-subtle">{balance.label}</span>
              <span className="text-xl font-bold tabular-nums text-app-members-count">
                {balance.amount}
              </span>
            </div>
          ))}
        </div>
      </section>
      <nav aria-label="Wallet actions" className="mt-4 space-y-2">
        {vm.actions.map((action) => {
          const Icon = icons[action.kind];
          const content = (
            <>
              <Icon
                size={27}
                strokeWidth={1.8}
                className="shrink-0 text-app-members-count"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-[13px] font-semibold">{action.title}</span>
                <span className="mt-0.5 block text-[10px] leading-relaxed text-app-subtle">
                  {action.description}
                </span>
                {action.status && (
                  <span className="mt-0.5 block text-[9px] text-app-members-count">
                    {action.status}
                  </span>
                )}
              </span>
              <ChevronRight size={20} className="shrink-0 text-app-subtle" aria-hidden="true" />
            </>
          );
          const className =
            "flex min-h-16 w-full items-center gap-4 rounded-lg border border-app-card-border bg-app-card px-4 py-3";
          return action.href ? (
            <Link
              key={action.kind}
              href={action.href}
              className={`${className} hover:border-kink-gold-bright/50`}
            >
              {content}
            </Link>
          ) : (
            <button
              key={action.kind}
              type="button"
              disabled
              className={`${className} cursor-not-allowed`}
            >
              {content}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
