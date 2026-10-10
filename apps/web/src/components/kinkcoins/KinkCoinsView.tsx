import { ChevronRight, Gift, LockKeyhole, ShieldCheck, Sparkles, Star, Users } from "lucide-react";
import type { getKinkCoinsVM } from "@/presenters/getKinkCoinsVM";
import CoinMedallion from "./CoinMedallion";

export default function KinkCoinsView({ vm }: { vm: ReturnType<typeof getKinkCoinsVM> }) {
  const { copy } = vm;
  return (
    <div className="mx-auto w-full max-w-[600px] px-3 pb-8 text-app-text sm:px-5">
      <section className="relative -mx-3 overflow-hidden border-b border-kink-gold-bright/20 bg-[radial-gradient(ellipse_at_top_left,#bb841c20,transparent_65%)] px-4 pb-5 pt-6 sm:mx-0 sm:rounded-2xl">
        <div className="pointer-events-none absolute -left-12 -top-14 h-52 w-72 -rotate-35 rounded-[50%] border border-kink-gold-bright/25" />
        <div className="relative flex items-center gap-4">
          <div className="relative flex h-24 w-[148px] shrink-0 items-center justify-center">
            <CoinMedallion kind="star" className="absolute bottom-3 left-0 size-11 text-xs" />
            <CoinMedallion kind="crown" className="absolute bottom-3 right-0 size-11 text-xs" />
            <CoinMedallion kind="coin" className="relative z-10 size-[78px] text-xl" />
          </div>
          <div>
            <h2 className="text-[25px] font-bold leading-tight text-app-members-count">
              {copy.heading}
            </h2>
            <p className="mt-2 text-[11px] leading-relaxed text-app-subtle">{copy.subtitle}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 divide-x divide-kink-gold-bright/25">
          {[LockKeyhole, Users, Star].map((Icon, i) => (
            <div
              key={copy.benefits[i]}
              className="flex items-center gap-2 px-2 first:pl-0 last:pr-0"
            >
              <Icon size={17} className="shrink-0 text-app-members-count" />
              <span className="text-[10px] leading-tight">{copy.benefits[i]}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="my-4 flex items-center justify-between gap-3 rounded-xl border border-kink-gold-bright/35 bg-app-card px-4 py-3">
        <div>
          <p className="text-xs text-app-subtle">{copy.balance}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {vm.balance.amount}{" "}
            <span className="text-sm font-medium text-app-subtle">{vm.balance.label}</span>
          </p>
        </div>
        <span className="rounded-full border border-kink-gold-bright/35 px-2.5 py-1 text-[10px] font-semibold text-app-members-count">
          {copy.preview}
        </span>
      </section>
      <p className="mb-4 text-[11px] leading-relaxed text-app-subtle">{copy.notice}</p>
      <div className="space-y-3">
        {vm.currencies.map((currency) => (
          <section
            key={currency.kind}
            className="rounded-lg border border-[#8d722d] bg-[linear-gradient(145deg,var(--app-card),var(--app-surface))] p-3 shadow-[inset_0_1px_0_#f5d66c16]"
          >
            <div className="mb-3 flex items-center gap-3">
              <CoinMedallion kind={currency.kind} />
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-bold text-app-members-count">{currency.name}</h3>
                <p className="mt-0.5 text-[10px] text-app-subtle">{currency.description}</p>
                <span className="mt-1 inline-block rounded-full border border-kink-gold-bright/50 px-2 py-0.5 text-[10px] font-semibold">
                  {currency.unitPrice}
                </span>
              </div>
              <ChevronRight size={17} className="text-app-members-count" aria-hidden="true" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {currency.packs.map((pack) => (
                <div
                  key={pack.quantity}
                  className="relative flex min-w-0 flex-col items-center rounded-md border border-[#8d722d]/80 px-1 pb-2 pt-3 text-center"
                >
                  {pack.badge && (
                    <span className="absolute -top-1.5 rounded bg-[#f6cd56] px-1.5 py-0.5 text-[7px] font-extrabold leading-none text-[#3c2800]">
                      {pack.badge}
                    </span>
                  )}
                  <p className="text-[13px] font-bold tabular-nums">{pack.quantity}</p>
                  <p className="text-[9px] text-app-subtle">{currency.plural}</p>
                  <div className="my-2 flex items-center gap-1 text-[11px]">
                    <CoinMedallion kind={currency.kind} className="size-3.5 border text-[4px]" />
                    {pack.price}
                  </div>
                  <button
                    type="button"
                    disabled
                    title={copy.comingSoon}
                    aria-label={`${copy.buy}: ${pack.quantity} ${currency.plural}, ${pack.price}. ${copy.comingSoon}`}
                    className="w-full cursor-not-allowed rounded-full bg-[linear-gradient(#ffe380,#eabd31)] py-1 text-[9px] font-bold text-[#322200] shadow-[0_2px_5px_#d7a72020]"
                  >
                    {copy.buy}
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3 rounded-lg border border-[#8d722d] bg-app-card p-3">
        <ShieldCheck size={23} className="text-app-members-count" />
        <div>
          <h3 className="text-xs font-bold text-app-members-count">{copy.secure}</h3>
          <p className="mt-1 text-[10px] text-app-subtle">{copy.secureHint}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {[
          { Icon: Sparkles, title: copy.earn, text: copy.earnHint },
          { Icon: Gift, title: copy.gift, text: copy.giftHint },
        ].map(({ Icon, title, text }) => (
          <section key={title} className="rounded-xl border border-app-card-border bg-app-card p-3">
            <Icon size={20} className="mb-2 text-app-members-count" />
            <h3 className="text-xs font-bold">{title}</h3>
            <p className="mt-1 text-[10px] leading-relaxed text-app-subtle">{text}</p>
            <p className="mt-2 text-[10px] font-semibold text-app-members-count">
              {copy.comingSoon}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
