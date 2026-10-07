import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  Banknote,
  ChevronRight,
  Clock,
  Home,
  Hourglass,
  Landmark,
  ReceiptText,
  ShieldCheck,
  TriangleAlert,
  Wallet,
  Zap,
} from "lucide-react";
import type { useKinkCoinsWithdrawPresenter } from "@/presenters/useKinkCoinsWithdrawPresenter";
import CoinMedallion from "./CoinMedallion";

type Props = { vm: ReturnType<typeof useKinkCoinsWithdrawPresenter> };
const card = "rounded-xl border border-app-card-border bg-app-card";
const goldButton =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(#ffe380,#eabd31)] px-5 py-3 text-xs font-bold text-[#322200]";

export default function KinkCoinsWithdrawView({ vm }: Props) {
  const { copy, confirmation } = vm;
  return (
    <div className="mx-auto w-full max-w-[600px] space-y-4 px-5 pb-8 pt-4 text-app-text">
      <div className="hidden lg:block">
        {vm.step === "options" ? (
          <Link
            href={vm.walletHref}
            className="inline-flex items-center gap-2 text-sm text-app-members-count"
          >
            <ArrowLeft size={18} />
            {copy.back}
          </Link>
        ) : (
          <button
            type="button"
            onClick={vm.onBack}
            className="inline-flex items-center gap-2 text-sm text-app-members-count"
          >
            <ArrowLeft size={18} />
            {copy.backOptions}
          </button>
        )}
      </div>
      <aside className="rounded-lg border border-kink-gold-bright/30 bg-kink-gold-bright/10 px-3 py-2 text-[10px] leading-relaxed text-app-subtle">
        <strong className="block text-app-members-count">{copy.preview}</strong>
        {copy.previewNotice}
      </aside>
      {vm.step === "options" && (
        <>
          <section className="bg-[radial-gradient(ellipse_at_top,#bb841c16,transparent_70%)] pb-1 text-center">
            <Wallet size={42} className="mx-auto my-4 text-app-members-count" aria-hidden="true" />
            <h2 className="text-xl font-bold">{copy.heading}</h2>
            <p className="mt-2 text-xs leading-relaxed text-app-subtle">{copy.description}</p>
          </section>
          <section
            aria-label="Sample balances"
            className="grid grid-cols-3 divide-x divide-app-card-border rounded-xl border border-kink-gold-bright/35 bg-app-card py-4"
          >
            {vm.currencies.map((currency) => (
              <div key={currency.kind} className="flex flex-col items-center gap-1">
                <CoinMedallion kind={currency.kind} className="mb-1 size-9 text-[10px]" />
                <span className="text-xs text-app-subtle">{currency.label}</span>
                <span className="text-lg font-bold text-app-members-count">{currency.balance}</span>
              </div>
            ))}
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-bold">{copy.options}</h2>
            <p className="text-xs leading-relaxed text-app-subtle">{copy.optionsHint}</p>
            {vm.currencies.map((currency) => (
              <article
                key={currency.kind}
                className={`${card} p-3 ${currency.eligible ? "border-kink-gold-bright/35" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <CoinMedallion kind={currency.kind} className="size-12 shrink-0 text-sm" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold">{currency.label}</h3>
                    <p className="mt-1 text-[10px] text-app-subtle">{currency.rate}</p>
                  </div>
                  <button
                    type="button"
                    disabled={!currency.eligible}
                    onClick={() => vm.onRedeem(currency.kind)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[linear-gradient(#ffe380,#eabd31)] px-3 py-2.5 text-[11px] font-bold text-[#322200] disabled:cursor-not-allowed disabled:bg-none disabled:bg-app-card-border disabled:text-app-subtle"
                  >
                    {currency.redeem}
                    <ChevronRight size={15} aria-hidden="true" />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 divide-x divide-app-card-border border-t border-app-card-border pt-2 text-[10px] text-app-subtle">
                  <div>
                    {copy.balance}
                    <p className="mt-0.5 text-xs font-bold text-app-members-count">
                      {currency.balance} {currency.label}
                    </p>
                  </div>
                  <div className="pl-3">
                    {copy.value}
                    <p className="mt-0.5 text-xs font-bold text-app-members-count">
                      {currency.value}
                    </p>
                  </div>
                </div>
                {!currency.eligible && (
                  <p className="mt-2 text-right text-[10px] text-app-subtle">{copy.belowMinimum}</p>
                )}
              </article>
            ))}
          </section>
          <div className={`${card} grid grid-cols-3 divide-x divide-app-card-border py-3`}>
            {[ShieldCheck, Zap, Ban].map((Icon, i) => (
              <div key={copy.benefits[i]} className="flex items-center gap-2 px-2">
                <Icon size={20} className="shrink-0 text-app-members-count" aria-hidden="true" />
                <span className="text-[9px] text-app-subtle">{copy.benefits[i]}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {vm.step === "confirm" && confirmation && (
        <>
          <p className="text-xs text-app-subtle">{copy.review}</p>
          <section className={`${card} flex items-center gap-3 p-4`}>
            <CoinMedallion kind={confirmation.kind} className="size-14 shrink-0 text-base" />
            <div className="flex-1">
              <h2 className="text-xs font-semibold">{confirmation.label}</h2>
              <p className="my-1 text-2xl font-bold text-app-members-count">
                {confirmation.quantity}
              </p>
              <p className="text-[10px] text-app-subtle">{copy.minimum}</p>
            </div>
            <ArrowRight size={20} className="text-app-members-count" aria-hidden="true" />
            <div>
              <Banknote size={25} className="mb-2 text-app-members-count" aria-hidden="true" />
              <p className="text-[10px] text-app-subtle">{copy.equivalent}</p>
              <p className="text-xl font-bold text-app-members-count">{confirmation.amount}</p>
            </div>
          </section>
          <section className={`${card} flex items-center gap-4 p-4`}>
            <Landmark size={33} className="shrink-0 text-app-members-count" aria-hidden="true" />
            <div className="flex-1">
              <h2 className="text-sm font-bold">{copy.bankTitle}</h2>
              <p className="mt-1 text-xs text-app-subtle">{copy.bank}</p>
              <p className="mt-1 text-[10px] text-app-subtle">{copy.account}</p>
            </div>
            <span className="rounded-full bg-kink-gold-bright/10 px-2 py-1 text-[9px] text-app-members-count">
              {copy.saved}
            </span>
          </section>
          <section className={`${card} space-y-3 p-4`}>
            <div className="flex items-center gap-3 text-xs">
              <CoinMedallion kind={confirmation.kind} className="size-5 text-[6px]" />
              <span className="flex-1 text-app-subtle">{copy.redemption}</span>
              <span>{confirmation.amount}</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <ReceiptText size={20} className="text-app-subtle" aria-hidden="true" />
              <span className="flex-1 text-app-subtle">{copy.fee}</span>
              <span>{confirmation.fee}</span>
            </div>
            <div className="flex items-center gap-3 border-t border-app-card-border pt-3">
              <Wallet size={22} className="text-app-members-count" aria-hidden="true" />
              <span className="flex-1 text-sm font-bold">{copy.receive}</span>
              <span className="text-xl font-bold text-app-members-count">
                {confirmation.amount}
              </span>
            </div>
          </section>
          <section className={`${card} flex items-center gap-3 p-4`}>
            <Clock size={25} className="text-app-subtle" aria-hidden="true" />
            <div>
              <h2 className="text-[10px] text-app-subtle">{copy.transfer}</h2>
              <p className="mt-1 text-xs">
                {copy.time} <span className="text-app-subtle">· {copy.timeHint}</span>
              </p>
            </div>
          </section>
          <aside className="flex gap-3 rounded-xl border border-red-500/50 bg-red-500/5 p-4">
            <TriangleAlert size={27} className="shrink-0 text-red-500" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-bold text-red-500">{copy.important}</h2>
              <p className="mt-1 text-[11px] leading-relaxed text-app-subtle">{copy.warning}</p>
            </div>
          </aside>
          <button type="button" onClick={vm.onConfirm} className={`${goldButton} w-full`}>
            {copy.confirm}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </>
      )}
      {vm.step === "processing" && confirmation && (
        <>
          <section className="py-4 text-center" aria-live="polite">
            <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-kink-gold-bright/10 text-app-members-count">
              <Hourglass size={40} aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-2xl font-bold">{copy.submitted}</h2>
            <p className="mx-auto mt-3 max-w-xs text-xs leading-relaxed text-app-subtle">
              {copy.submittedHint}
            </p>
          </section>
          <section className={`${card} space-y-5 p-5`}>
            <div className="flex gap-4">
              <Banknote size={26} className="text-app-members-count" aria-hidden="true" />
              <div>
                <p className="text-xl font-bold text-app-members-count">{confirmation.amount}</p>
                <p className="mt-1 text-xs text-app-subtle">{copy.amount}</p>
              </div>
            </div>
            <div className="flex gap-4">
              <Landmark size={26} className="text-app-members-count" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">{copy.method}</p>
                <p className="mt-1 text-xs text-app-subtle">{copy.destination}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Clock size={26} className="text-app-members-count" aria-hidden="true" />
              <div>
                <p className="text-xs">{copy.expected}</p>
                <p className="mt-1 text-[10px] text-app-subtle">{copy.timeHint}</p>
              </div>
            </div>
          </section>
          <section className={`${card} p-4`}>
            <h3 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-app-subtle">
              <ReceiptText size={17} aria-hidden="true" />
              {copy.reference}
            </h3>
            <p className="mt-3 font-mono text-sm font-bold text-app-members-count">
              {copy.referenceValue}
            </p>
          </section>
          <aside className="rounded-xl border border-kink-gold-bright/30 bg-kink-gold-bright/5 p-4">
            <h3 className="mb-2 text-xs font-semibold text-app-members-count">
              {copy.processingLabel}
            </h3>
            <p className="text-xs leading-relaxed text-app-subtle">{copy.processing}</p>
            <p className="mt-3 text-xs leading-relaxed text-app-subtle">{copy.balanceUpdate}</p>
          </aside>
          <Link href={vm.homeHref} className={`${goldButton} w-full`}>
            <Home size={18} aria-hidden="true" />
            {copy.home}
          </Link>
        </>
      )}
    </div>
  );
}
