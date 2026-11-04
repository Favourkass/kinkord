import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Clock3, Copy, ShieldCheck } from "lucide-react";
import {
  ringButton,
  ringPanel,
  RingPurchaseSummary,
  type RingPurchaseSummaryProps,
} from "./RingPurchaseView";
import type { usePaymentPresenter } from "@/presenters/usePaymentPresenter";

interface ResultProps {
  summary: RingPurchaseSummaryProps;
  notice: { title: string; body: string; tone: "success" | "info" | "problem" } | null;
  backHref: string;
  hero: string;
}
export function RingPaymentResult(p: ResultProps) {
  return (
    <section className="mx-auto max-w-[600px] space-y-6 py-8 text-white">
      {p.notice?.tone === "success" ? (
        <CheckCircle2 className="mx-auto size-20 text-kink-gold-bright" />
      ) : (
        <Clock3 className="mx-auto size-20 text-kink-gold-bright" />
      )}
      <h1 className="text-center text-3xl font-bold">{p.notice?.title}</h1>
      <p role="status" className="text-center text-white/70">
        {p.notice?.body}
      </p>
      <div className="relative mx-auto h-40 w-full max-w-xs">
        <Image
          src={p.hero}
          alt="Gold gift rings"
          fill
          sizes="320px"
          className="rounded-2xl object-cover"
        />
      </div>
      <RingPurchaseSummary {...p.summary} />
      {p.summary.status === "Pending Verification" && (
        <section className={ringPanel}>
          <h2 className="text-lg font-bold">What Happens Next?</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-white/70">
            <li>We’ll review your payment proof.</li>
            <li>You’ll receive a notification once approved.</li>
            <li>Your Kink Rings will be added to your account and you can start gifting.</li>
          </ol>
        </section>
      )}
      <Link href={p.backHref} className={ringButton}>
        Back to Kink Rings
      </Link>
    </section>
  );
}
export default function RingPaymentView(p: ReturnType<typeof usePaymentPresenter>) {
  if (!p.ringSummary || !p.amount || !p.bank || !p.reference) return null;
  if (p.notice)
    return (
      <RingPaymentResult
        summary={p.ringSummary}
        notice={p.notice}
        backHref={p.backHref}
        hero={p.ringHero}
      />
    );
  const copyButton = (action: { label?: string; copyLabel?: string; onCopy: () => void }) => (
    <button
      onClick={action.onCopy}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#8c702e] px-3 py-2 text-xs text-kink-gold-bright"
    >
      <Copy size={14} />
      {action.label ?? action.copyLabel}
    </button>
  );
  return (
    <main className="mx-auto max-w-[650px] space-y-5 py-6 text-white">
      <div className="relative h-56 overflow-hidden rounded-2xl">
        <Image src={p.ringHero} alt="Gold Kink Rings" fill sizes="650px" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
        <div className="absolute bottom-4 left-4">
          <h1 className="text-3xl font-bold">
            Pay for <span className="text-kink-gold-bright">Kink Rings</span>
          </h1>
          <p className="mt-2 max-w-xs text-sm text-white/70">
            Transfer the exact amount below to complete your purchase.
          </p>
        </div>
      </div>
      <RingPurchaseSummary {...p.ringSummary} />
      <div className={`${ringPanel} flex items-center justify-between`}>
        <span className="flex items-center gap-2">
          <Clock3 size={18} />
          Expires in
        </span>
        <strong role="timer" className="text-2xl text-kink-gold-bright">
          {p.countdown}
        </strong>
      </div>
      <section className={ringPanel}>
        <h2 className="text-white/65">Payment Amount (₦)</h2>
        <div className="mt-2 flex items-center justify-between gap-2">
          <strong className="text-3xl text-kink-gold-bright">{p.amount.value}</strong>
          {copyButton(p.amount)}
        </div>
        <p className="text-sm text-white/60">{p.amount.usd}</p>
        <p className="mt-4 border-t border-white/10 pt-3 text-sm">
          Your unique payment amount. Do not modify this amount.
        </p>
      </section>
      <section className={`${ringPanel} space-y-4`}>
        <h2 className="text-xl font-bold">Bank Transfer Details</h2>
        <p className="text-sm text-white/60">
          Transfer to the account below using the exact amount.
        </p>
        <div>
          <p className="text-xs text-white/55">Bank Name</p>
          <p>{p.bank.name}</p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-white/55">Account Name</p>
            <p>{p.bank.accountName}</p>
          </div>
          {copyButton(p.bank.copyAccountName)}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-white/55">Account Number</p>
            <p>{p.bank.accountNumber}</p>
          </div>
          {copyButton(p.bank.copyAccountNumber)}
        </div>
        <div className="rounded-xl bg-white/5 p-3">
          <p className="text-xs text-white/55">Your Payment Reference / Code</p>
          <p className="my-2 break-all font-bold">{p.reference.value}</p>
          {copyButton(p.reference)}
        </div>
      </section>
      {p.view === "pay" ? (
        <>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={p.confirmed}
              onChange={p.toggleConfirmed}
              className="mt-1 size-5 accent-[#ffc020]"
            />
            I have completed the bank transfer using the details above.
          </label>
          <button className={ringButton} disabled={!p.canContinue} onClick={p.proceed}>
            I’ve Completed the Payment
          </button>
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-amber-200">
            The transfer window has ended. If you already paid, submit proof now.
          </p>
          <button onClick={p.proceed} className={ringButton}>
            I’ve already paid — submit proof
          </button>
          <button onClick={p.restart} className="w-full p-3 underline">
            Start a new purchase
          </button>
        </div>
      )}
      <p className="flex items-center gap-2 text-sm text-white/55">
        <ShieldCheck size={18} />
        Your payment details are securely handled.
      </p>
      {p.error && (
        <p role="alert" className="text-red-300">
          {p.error}
        </p>
      )}
    </main>
  );
}
