"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import GoldCta from "@/components/auth/GoldCta";
import type { LocationCheckPanelVM } from "@/presenters/useLocationCheckPresenter";

interface Props extends LocationCheckPanelVM {
  /** Fields shown above the button, e.g. choosing a new country. */
  children?: React.ReactNode;
}

/** The country check: why it's asked, the one button, and what to do when it fails. */
export default function LocationCheckPanel({ children, ...vm }: Props) {
  return (
    <section className="flex w-full max-w-[640px] flex-col items-center gap-6 text-center lg:gap-8">
      <span className="grid size-14 place-items-center rounded-full border-2 border-kink-gold-bright text-kink-gold-bright lg:size-20">
        <MapPin aria-hidden className="size-7 lg:size-10" />
      </span>
      <h1 className="text-[22px] font-black text-kink-cream lg:text-[42px]">
        {vm.heading.plain} <span className="text-kink-gold-bright">{vm.heading.highlight}</span>
      </h1>
      <div className="flex w-full flex-col gap-3 rounded-[18px] border border-kink-line bg-kink-surface px-5 py-5 text-left text-[14px] leading-6 text-kink-mist sm:px-6 lg:text-[17px] lg:leading-7">
        {vm.chose && <p className="font-semibold text-kink-cream">{vm.chose}</p>}
        {vm.intro.map((line) => (
          <p key={line}>{line}</p>
        ))}
        <Link
          href={vm.privacy.href}
          target="_blank"
          className="font-semibold text-kink-gold-bright underline-offset-4 hover:underline"
        >
          {vm.privacy.label}
        </Link>
      </div>

      {vm.notice && (
        <p role="status" className="text-[14px] text-kink-cream lg:text-[16px]">
          {vm.notice}
        </p>
      )}
      {vm.problem && (
        <div
          role="alert"
          className="w-full rounded-[18px] border border-red-400/50 bg-red-500/10 px-5 py-4 text-left text-[14px] leading-6 text-red-200 lg:text-[16px]"
        >
          <p>{vm.problem.message}</p>
          {vm.problem.hint && <p className="mt-2 text-kink-cream">{vm.problem.hint}</p>}
        </div>
      )}

      {children}

      <div className="flex w-full max-w-[564px] flex-col gap-3">
        <GoldCta
          label={vm.share.label}
          onClick={vm.share.onClick}
          disabled={vm.share.disabled || vm.share.busy}
          arrow={!vm.share.busy}
        />
        {vm.problem?.change && (
          <GoldCta
            label={vm.problem.change.label}
            onClick={vm.problem.change.onClick}
            variant="outline"
            arrow={false}
          />
        )}
        {vm.skip && (
          <button
            type="button"
            onClick={vm.skip.onClick}
            disabled={vm.share.busy}
            className="py-2 text-[14px] font-semibold text-kink-dim hover:text-kink-cream disabled:opacity-40 lg:text-[16px]"
          >
            {vm.skip.label}
          </button>
        )}
      </div>
    </section>
  );
}
