import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
  Clock3,
  Coins,
  Landmark,
  Minus,
  Plus,
  ShieldCheck,
} from "lucide-react";
import type { RingPurchaseVM } from "@/presenters/useRingPurchasePresenter";

export const ringPanel =
  "rounded-2xl border border-[#8c702e]/60 bg-gradient-to-br from-[#211b0d] via-[#0e0e0d] to-black p-5";
export const ringButton =
  "flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#ffdc62] to-[#f4b000] px-5 py-4 font-bold text-black disabled:opacity-40";
export interface RingPurchaseSummaryProps {
  title: string;
  amount: string;
  usd: string;
  reference: string;
  date: string;
  status: string;
  ringExpiry: string | null;
}
export function RingPurchaseSummary(p: RingPurchaseSummaryProps) {
  return (
    <section className={ringPanel} aria-label="Purchase details">
      <h2 className="text-xl font-bold text-kink-gold-bright">{p.title}</h2>
      <p className="mt-2 text-2xl font-bold">
        {p.amount} <span className="text-sm font-normal text-white/60">({p.usd})</span>
      </p>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-white/55">Payment Reference / Code</dt>
          <dd className="break-all font-semibold">{p.reference}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Date</dt>
          <dd>{p.date}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Status</dt>
          <dd className="text-kink-gold-bright">{p.status}</dd>
        </div>
        {p.ringExpiry && (
          <div className="flex justify-between gap-3">
            <dt>Ring expiry</dt>
            <dd>{p.ringExpiry}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
export default function RingPurchaseView(p: RingPurchaseVM) {
  const c = p.copy;
  return (
    <main className="mx-auto min-h-screen w-full max-w-[720px] bg-black px-5 pb-12 pt-5 text-white sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <Link href={p.backHref} className="p-2" aria-label={c.back}>
          <ArrowLeft />
        </Link>
        {!p.historyOnly && (
          <Link
            href={p.historyHref}
            className="flex items-center gap-2 text-sm text-kink-gold-bright"
          >
            <Clock3 size={18} />
            {c.history}
            <ChevronRight size={16} />
          </Link>
        )}
      </header>
      {p.paid ? (
        <div className="space-y-6 py-8">
          <CheckCircle2 className="mx-auto size-20 text-kink-gold-bright" />
          <h1 className="text-center text-3xl font-bold">{c.success}</h1>
          <p className="text-center text-white/70">{c.successBody}</p>
          <div className="relative mx-auto h-48 max-w-sm">
            <Image
              src={p.hero}
              alt="Gold Kink Ring"
              fill
              sizes="400px"
              className="rounded-2xl object-cover"
            />
          </div>
          <RingPurchaseSummary {...p.paid} />
          <Link href={p.backHref} className={ringButton}>
            {c.done}
          </Link>
        </div>
      ) : p.historyOnly ? (
        <div className="space-y-5 py-8">
          <h1 className="text-3xl font-bold text-kink-gold-bright">{c.historyTitle}</h1>
          {!p.loading && !p.history.length && <p>{c.noHistory}</p>}
          {p.history.map((h) => (
            <Link key={h.id} href={h.href} className="block">
              <RingPurchaseSummary {...h} />
            </Link>
          ))}
          {p.more && (
            <button disabled={p.loading} onClick={p.onMore} className={ringButton}>
              {c.more}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="relative my-5 overflow-hidden rounded-2xl bg-[#100e06]">
            <Image
              src={p.hero}
              alt="Gold Kink Ring"
              width={720}
              height={440}
              sizes="(max-width: 720px) 100vw, 720px"
              className="h-64 w-full object-cover sm:h-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
            <div className="absolute bottom-4 left-5 right-5">
              <h1 className="text-4xl font-bold text-kink-gold-bright">{c.title}</h1>
              <p className="mt-2 max-w-sm text-sm text-white/80">{c.intro}</p>
            </div>
          </div>
          <div className="space-y-5">
            {p.step === "quantity" ? (
              <>
                <section className={ringPanel}>
                  <p className="text-sm text-white/60">{c.balance}</p>
                  <p className="mt-1 text-2xl font-bold">
                    <span className="text-kink-gold-bright">{p.quote?.rings ?? "—"}</span> Kink
                    Rings
                  </p>
                </section>
                <section className={ringPanel}>
                  <h2 className="text-2xl font-bold text-kink-gold-bright">{c.pack}</h2>
                  <p className="mt-2 text-sm text-white/65">{c.quantity}</p>
                  <div className="my-5 flex items-center gap-4">
                    <button
                      aria-label="Remove two rings"
                      disabled={p.quantity <= 2 || p.busy || p.uncertain}
                      onClick={() => p.onQuantity(p.quantity - 2)}
                      className="rounded-full border border-kink-gold-bright p-3 text-kink-gold-bright disabled:opacity-40"
                    >
                      <Minus />
                    </button>
                    <output className="flex-1 rounded-xl border border-[#8c702e] p-4 text-center text-xl font-bold">
                      {p.quantity} Rings
                    </output>
                    <button
                      aria-label="Add two rings"
                      disabled={p.quantity >= 100 || p.busy || p.uncertain}
                      onClick={() => p.onQuantity(p.quantity + 2)}
                      className="rounded-full border border-kink-gold-bright p-3 text-kink-gold-bright disabled:opacity-40"
                    >
                      <Plus />
                    </button>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/10 pt-4">
                    <span>{c.total}</span>
                    <strong className="text-3xl text-kink-gold-bright">
                      {p.quote?.usd ?? "—"}
                    </strong>
                  </div>
                  <p className="mt-1 text-right text-sm text-white/55">
                    ≈ {p.quote?.amount ?? "—"}
                  </p>
                  <p className="mt-4 flex gap-2 text-sm text-white/65">
                    <Clock3 className="shrink-0 text-kink-gold-bright" size={18} />
                    {c.expiry}
                  </p>
                </section>
              </>
            ) : (
              <section className={ringPanel}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-bold">{c.summary}</h2>
                  <button
                    onClick={p.onBack}
                    disabled={p.busy || p.uncertain}
                    className="text-sm text-kink-gold-bright underline disabled:opacity-40"
                  >
                    Edit quantity
                  </button>
                </div>
                <p className="mt-3 text-2xl font-bold text-kink-gold-bright">
                  {p.quantity} Rings = {p.quote?.usd ?? "—"}
                </p>
                <p className="mt-1 text-sm text-white/60">≈ {p.quote?.amount ?? "—"}</p>
              </section>
            )}
            {p.step === "method" && (
              <fieldset className="space-y-4" disabled={p.busy || p.uncertain}>
                <legend className="mb-4 text-xl font-bold">{c.choose}</legend>
                {(["coins", "bank"] as const).map((m) => (
                  <label
                    key={m}
                    className={`${ringPanel} block cursor-pointer ${p.method === m ? "ring-1 ring-kink-gold-bright" : ""}`}
                  >
                    <span className="flex items-center gap-3">
                      {m === "coins" ? (
                        <Coins className="text-kink-gold-bright" />
                      ) : (
                        <Landmark className="text-kink-gold-bright" />
                      )}
                      <strong className="flex-1 text-lg">{m === "coins" ? c.coins : c.bank}</strong>
                      <input
                        type="radio"
                        name="method"
                        value={m}
                        checked={p.method === m}
                        onChange={() => p.onMethod(m)}
                        className="size-5 accent-[#ffc020]"
                      />
                    </span>
                    <span className="mt-2 block text-sm text-white/65">
                      {m === "coins" ? c.coinHelp : c.bankHelp}
                    </span>
                    {m === "coins" ? (
                      <span className="mt-4 grid grid-cols-2 gap-4 rounded-xl bg-white/5 p-3 text-sm">
                        <span>
                          {c.coinBalance}
                          <strong className="mt-1 block text-kink-gold-bright">
                            {p.quote?.balance ?? "—"}
                          </strong>
                        </span>
                        <span>
                          {c.required}
                          <strong className="mt-1 block text-kink-gold-bright">
                            {p.quote?.coins ?? "—"}
                          </strong>
                        </span>
                      </span>
                    ) : null}
                    {!(m === "coins" ? p.coinsAvailable : p.bankAvailable) && (
                      <span className="mt-3 block text-sm text-amber-200">{c.disabled}</span>
                    )}
                  </label>
                ))}
                {p.method === "coins" && p.insufficient && (
                  <p className="text-sm text-amber-200">
                    {c.insufficient}{" "}
                    <Link href={p.topUpHref} className="underline">
                      {c.topUp}
                    </Link>
                  </p>
                )}
              </fieldset>
            )}
            <p className="flex items-center gap-2 text-sm text-white/60">
              <ShieldCheck className="text-kink-gold-bright" size={20} />
              Review your payment details before continuing.
            </p>
            {p.uncertain && <p className="text-sm text-amber-200">{c.retryNote}</p>}
            {p.step === "quantity" ? (
              <button disabled={!p.quote || p.loading} onClick={p.onReview} className={ringButton}>
                {c.review}
                <ChevronRight />
              </button>
            ) : (
              <button disabled={!p.canPay} onClick={() => void p.onPay()} className={ringButton}>
                {p.busy ? c.busy : p.uncertain ? c.retry : p.method === "coins" ? c.pay : c.proceed}
                <ChevronRight />
              </button>
            )}
          </div>
        </>
      )}
      {p.loading && (
        <p role="status" className="py-4">
          {c.loading}
        </p>
      )}
      {p.error && (
        <div role="alert" className="my-4 rounded-xl border border-red-800 p-4 text-red-200">
          <p>{p.error}</p>
          <button disabled={p.busy} onClick={p.onRefresh} className="mt-3 underline">
            {c.refresh}
          </button>
        </div>
      )}
    </main>
  );
}
