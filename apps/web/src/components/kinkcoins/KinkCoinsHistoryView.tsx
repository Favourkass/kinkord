import Link from "next/link";
import { ArrowLeft, ChevronRight, ScrollText } from "lucide-react";
import type { getKinkCoinsHistoryVM } from "@/presenters/getKinkCoinsVM";
import CoinMedallion from "./CoinMedallion";

export default function KinkCoinsHistoryView({
  vm,
}: {
  vm: ReturnType<typeof getKinkCoinsHistoryVM>;
}) {
  const { copy } = vm;
  return (
    <div className="mx-auto w-full max-w-[600px] space-y-5 px-5 pb-8 pt-5 text-app-text">
      <Link
        href={vm.walletHref}
        className="hidden w-fit items-center gap-2 text-sm font-semibold text-app-members-count lg:flex"
      >
        <ArrowLeft size={18} aria-hidden="true" />
        {copy.back}
      </Link>
      <section className="rounded-xl border border-kink-gold-bright/35 bg-[linear-gradient(145deg,var(--app-card),var(--app-surface))] p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2" aria-hidden="true">
            <CoinMedallion kind="coin" className="size-10 text-xs" />
            <CoinMedallion kind="star" className="size-8 text-[9px]" />
            <CoinMedallion kind="crown" className="size-8 text-[9px]" />
          </div>
          <span className="rounded-full border border-kink-gold-bright/35 px-2.5 py-1 text-[10px] font-semibold text-app-members-count">
            {copy.preview}
          </span>
        </div>
        <h2 className="mt-4 text-xl font-bold">{copy.heading}</h2>
        <p className="mt-2 text-xs leading-relaxed text-app-subtle">{copy.description}</p>
        <p className="mt-4 text-[11px] leading-relaxed text-app-subtle">{copy.notice}</p>
      </section>
      <section
        aria-label={copy.title}
        className="overflow-hidden rounded-xl border border-app-card-border bg-app-card"
      >
        <p className="border-b border-app-card-border px-4 py-3 text-xs font-semibold text-app-subtle">
          {copy.total}
        </p>
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-kink-gold-bright/10 text-app-members-count">
            <ScrollText size={30} aria-hidden="true" />
          </div>
          <h3 className="mt-5 text-lg font-bold">{copy.emptyTitle}</h3>
          <p className="mt-2 max-w-xs text-xs leading-relaxed text-app-subtle">
            {copy.emptyDescription}
          </p>
          <Link
            href={vm.buyHref}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(#ffe380,#eabd31)] px-5 py-2.5 text-xs font-bold text-[#322200]"
          >
            {copy.browse}
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
