import Link from "next/link";
import {
  ArrowRight,
  ArrowLeftRight,
  Coins,
  Gift,
  ChevronRight,
  Hourglass,
  Landmark,
  ReceiptText,
  Wallet,
} from "lucide-react";
import type { useWalletPresenter } from "@/presenters/useWalletPresenter";
import BankAccountsView from "./BankAccountsView";
import CoinMedallion from "./CoinMedallion";
interface Props {
  vm: ReturnType<typeof useWalletPresenter>;
}
const card = "rounded-xl border border-app-card-border bg-app-card p-4";
const button =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(#ffe380,#eabd31)] px-4 py-2.5 text-xs font-bold text-[#322200] disabled:cursor-not-allowed disabled:opacity-40";
const input =
  "mt-1 w-full rounded-lg border border-app-card-border bg-app-surface p-3 text-sm text-app-text focus:border-kink-gold-bright";
export default function WalletView({ vm }: Props) {
  const { copy } = vm;
  return (
    <div className="mx-auto w-full max-w-[600px] space-y-4 px-5 pb-10 pt-5 text-app-text">
      {vm.mode !== "overview" && (
        <Link
          href={vm.walletHref}
          className="hidden text-sm font-semibold text-app-members-count lg:block"
        >
          ← {copy.back}
        </Link>
      )}
      {vm.testMode && (
        <aside
          role="note"
          className="rounded-lg border border-kink-gold-bright/40 bg-kink-gold-bright/10 p-3 text-xs font-semibold"
        >
          {copy.testMode}
        </aside>
      )}
      {vm.loading && <p role="status">{copy.loading}</p>}
      {vm.error && (
        <div role="alert" className="rounded-lg border border-red-500/40 p-3 text-sm text-red-500">
          {vm.error}
          <button type="button" onClick={vm.onRefresh} className="ml-3 underline">
            {copy.retry}
          </button>
        </div>
      )}
      {vm.notice && (
        <p role="status" className="text-sm text-app-members-count">
          {vm.notice}
        </p>
      )}
      {!vm.loading && !vm.enabled && (
        <aside className="rounded-lg border border-kink-gold-bright/30 bg-kink-gold-bright/10 p-3 text-xs leading-relaxed text-app-subtle">
          {copy.unavailable}
        </aside>
      )}
      {vm.mode === "overview" && (
        <>
          <section className="pt-2 text-center">
            <div className="relative mx-auto flex h-24 w-48 items-end justify-center">
              <CoinMedallion kind="star" className="absolute bottom-1 left-1 size-14 text-sm" />
              <CoinMedallion kind="crown" className="absolute bottom-1 right-1 size-14 text-sm" />
              <CoinMedallion kind="coin" className="relative size-24 text-2xl" />
            </div>
            <h2 className="mt-4 text-3xl font-bold text-app-members-count">{copy.heading}</h2>
            <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-app-subtle">
              {copy.subtitle}
            </p>
          </section>
          <section
            className={`${card} grid grid-cols-3 divide-x divide-app-card-border border-kink-gold-bright/40`}
            aria-label="Wallet balances"
          >
            {vm.currencies.map((currency) => (
              <div key={currency.kind} className="flex flex-col items-center gap-1 text-center">
                <CoinMedallion kind={currency.kind} className="size-8 text-[9px]" />
                <span className="text-xs text-app-subtle">{currency.label}</span>
                <strong className="text-xl text-app-members-count">
                  {currency.available.toLocaleString()}
                </strong>
                <span className="text-[9px] text-app-subtle">
                  {currency.reserved} {copy.reserved}
                </span>
              </div>
            ))}
          </section>
          <nav className="space-y-2" aria-label="Wallet actions">
            {vm.actions.map((action) =>
              action.href ? (
                <Link
                  key={action.key}
                  href={action.href}
                  className={`${card} flex items-center gap-3`}
                >
                  {action.key === "banks" ? (
                    <Landmark size={25} className="shrink-0 text-app-members-count" />
                  ) : action.key === "history" ? (
                    <ReceiptText size={25} className="shrink-0 text-app-members-count" />
                  ) : action.key === "buy" ? (
                    <Coins size={25} className="shrink-0 text-app-members-count" />
                  ) : (
                    <Wallet size={25} className="shrink-0 text-app-members-count" />
                  )}
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">{action.title}</span>
                    <span className="mt-1 block text-[10px] text-app-subtle">
                      {action.description}
                    </span>
                  </span>
                  <ChevronRight size={18} />
                </Link>
              ) : (
                <div
                  key={action.key}
                  aria-disabled="true"
                  className={`${card} flex items-center gap-3`}
                >
                  {action.key === "earn" ? (
                    <Gift size={25} className="shrink-0 text-app-members-count" />
                  ) : (
                    <ArrowLeftRight size={25} className="shrink-0 text-app-members-count" />
                  )}
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">{action.title}</span>
                    <span className="mt-1 block text-[10px] text-app-subtle">
                      {action.description}
                    </span>
                    <span className="mt-1 block text-[10px] text-app-members-count">
                      {copy.comingSoon}
                    </span>
                  </span>
                </div>
              ),
            )}
          </nav>
        </>
      )}
      {vm.mode === "buy" && (
        <>
          <p className="text-xs leading-relaxed text-app-subtle">{copy.buyHint}</p>
          <form
            className={`${card} space-y-4`}
            onSubmit={(event) => {
              event.preventDefault();
              if (vm.purchaseQuote.valid) vm.onBuy(vm.buyCurrency, Number(vm.buyQuantity));
            }}
          >
            <h2 className="font-bold text-app-members-count">{copy.customPurchase}</h2>
            <select
              aria-label="Gift currency"
              value={vm.buyCurrency}
              onChange={(event) => vm.onBuyCurrency(event.target.value as typeof vm.buyCurrency)}
              className={input}
              disabled={vm.busy}
            >
              {vm.currencies.map((currency) => (
                <option key={currency.kind} value={currency.kind}>
                  {currency.label}
                </option>
              ))}
            </select>
            <label className="block text-xs">
              {copy.purchaseQuantity}
              <input
                type="number"
                min="1"
                step="1"
                value={vm.buyQuantity}
                onChange={(event) => vm.onBuyQuantity(event.target.value)}
                className={input}
                disabled={vm.busy}
              />
            </label>
            <label className="block text-xs">
              {copy.purchaseBudget}
              <input
                type="number"
                min="0"
                step="0.01"
                value={vm.buyBudget}
                onChange={(event) => vm.onBuyBudget(event.target.value)}
                className={input}
                disabled={vm.busy}
              />
            </label>
            <p className="text-xs text-app-subtle">{copy.purchaseBudgetHint}</p>
            <p className="font-bold text-app-members-count">
              {copy.purchasePrice}: {vm.purchaseQuote.amount}
            </p>
            <button className={button} disabled={vm.busy || !vm.purchaseQuote.valid}>
              {copy.buy}
            </button>
          </form>
          {vm.currencies.map((currency) => (
            <section key={currency.kind} className={`${card} border-kink-gold-bright/35`}>
              <div className="mb-4 flex items-center gap-3">
                <CoinMedallion kind={currency.kind} />
                <div>
                  <h2 className="text-lg font-bold text-app-members-count">Kink{currency.label}</h2>
                  <p className="text-xs text-app-subtle">{currency.buyRate} / unit</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {currency.packs.map((pack) => (
                  <div
                    key={pack.quantity}
                    className="rounded-lg border border-kink-gold-bright/30 p-3 text-center"
                  >
                    <p className="text-lg font-bold">{pack.quantity.toLocaleString()}</p>
                    <p className="text-xs text-app-subtle">{currency.label}</p>
                    <p className="my-3 text-sm text-app-members-count">{pack.price}</p>
                    <button
                      type="button"
                      disabled={vm.busy || !vm.enabled}
                      onClick={() => vm.onBuy(currency.kind, pack.quantity)}
                      className={button}
                      aria-label={`${copy.buy}: ${pack.quantity} ${currency.label}`}
                    >
                      {copy.buy}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
      {vm.mode === "banks" && <BankAccountsView vm={vm} />}
      {vm.mode === "history" && (
        <>
          <p className="text-xs text-app-subtle">{copy.historyHint}</p>
          {!vm.history.length && !vm.loading && (
            <section className={`${card} py-12 text-center`}>
              <ReceiptText size={35} className="mx-auto mb-4 text-app-members-count" />
              <h2 className="font-bold">{copy.noHistory}</h2>
            </section>
          )}
          {vm.history.map((row) => (
            <article key={row.id} className={card}>
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-bold">{row.title}</h2>
                <span className="text-sm font-bold text-app-members-count">{row.amount}</span>
              </div>
              <p className="mt-2 text-xs">
                {row.quantityLabel} {copy.labels[row.currency]} · {row.statusLabel}
              </p>
              <p className="mt-2 break-all text-[10px] text-app-subtle">
                {row.reference} · {row.date}
              </p>
              <p className="mt-1 text-[10px] text-app-subtle">
                {row.counterpartyLabel ?? `${row.bankName} ${row.maskedAccount}`}
              </p>
              {row.reviewNote && <p className="mt-2 text-xs text-red-500">{row.reviewNote}</p>}
              {row.settlementReference && (
                <p className="mt-2 break-all text-[10px] text-app-subtle">
                  {copy.bankReference}: {row.settlementReference}
                </p>
              )}
              {row.href && (
                <Link
                  href={row.href}
                  className="mt-3 inline-block text-xs font-semibold text-app-members-count"
                >
                  {row.status === "pending" ? copy.resume : copy.reference} →
                </Link>
              )}
            </article>
          ))}
        </>
      )}
      {vm.mode === "withdraw" && !vm.operation && (
        <>
          <section className="text-center">
            <Wallet size={40} className="mx-auto mb-3 text-app-members-count" />
            <h2 className="text-xl font-bold">{vm.review ? copy.review : copy.titles.withdraw}</h2>
            <p className="mt-2 text-xs text-app-subtle">
              {copy.minimum}: {vm.minimum}
            </p>
          </section>
          <p className="text-xs leading-relaxed text-app-subtle">{copy.withdrawNotice}</p>
          {!vm.loading && !vm.canRedeem && (
            <section className={card}>
              <p className="text-sm text-app-subtle">{vm.redemptionReason}</p>
              <Link
                href={vm.subscriptionHref}
                className="mt-3 inline-block text-sm font-semibold text-app-members-count"
              >
                {copy.manageSubscription}
              </Link>
            </section>
          )}
          {!vm.review ? (
            vm.currencies.map((currency) => (
              <section key={currency.kind} className={`${card} flex items-center gap-3`}>
                <CoinMedallion kind={currency.kind} />
                <div className="flex-1">
                  <h3 className="font-bold">{currency.label}</h3>
                  <p className="mt-1 text-xs text-app-subtle">{currency.redeemRateLabel} / unit</p>
                  <p className="mt-1 text-xs text-app-subtle">
                    {copy.minimum}: {currency.minimumWithdrawalUnits} {currency.label}
                  </p>
                  <p className="mt-1 text-xs text-app-subtle">
                    {copy.available}: {currency.available.toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-app-subtle">
                    {copy.withdrawable}: {currency.withdrawable.toLocaleString()}
                  </p>
                  <p className="mt-1 text-[10px] text-app-subtle">
                    {currency.reserved} {copy.reserved}
                  </p>
                </div>
                <button
                  disabled={
                    vm.busy ||
                    !vm.enabled ||
                    !vm.canRedeem ||
                    !currency.withdrawable ||
                    !vm.banks.length
                  }
                  type="button"
                  onClick={() => vm.onRedeem(currency.kind)}
                  className={button}
                >
                  {copy.review}
                </button>
              </section>
            ))
          ) : (
            <form
              className={`${card} space-y-4`}
              // An unanswered request is sent again as it was, whatever the fields say now.
              noValidate={!!vm.unansweredNotice}
              onSubmit={(event) => {
                event.preventDefault();
                vm.onWithdraw();
              }}
            >
              <h3 className="font-bold text-app-members-count">{copy.labels[vm.currency]}</h3>
              <label className="block text-xs">
                {copy.quantity}
                <input
                  required
                  type="number"
                  min={1}
                  step={1}
                  value={vm.quantity}
                  disabled={vm.fieldsLocked}
                  onChange={(event) => vm.onQuantity(event.target.value)}
                  className={input}
                />
              </label>
              <label className="block text-xs">
                {copy.chooseWithdrawalBank}
                <select
                  aria-label={copy.chooseWithdrawalBank}
                  value={vm.bankId}
                  disabled={vm.fieldsLocked}
                  onChange={(event) => vm.onBank(event.target.value)}
                  required
                  className={input}
                >
                  {vm.banks.map((bank) => (
                    <option key={bank.id} value={bank.id}>
                      {bank.bankName} {bank.maskedNumber}
                    </option>
                  ))}
                </select>
              </label>
              {vm.selectedBank && (
                <p className="text-xs text-app-subtle">
                  {vm.selectedBank.accountName} · {vm.selectedBank.maskedNumber}
                </p>
              )}
              <p className="text-sm">
                {copy.estimate}:{" "}
                <strong className="text-xl text-app-members-count">{vm.quote.amount}</strong>
              </p>
              <p className="text-xs text-app-subtle">{copy.fee}</p>
              {vm.unansweredNotice && (
                <p className="text-xs text-app-subtle">{vm.unansweredNotice}</p>
              )}
              <button disabled={vm.busy || !vm.canSubmitWithdrawal} className={`${button} w-full`}>
                {copy.confirm}
                <ArrowRight size={16} />
              </button>
              {vm.canCancel && (
                <button
                  type="button"
                  disabled={vm.busy}
                  onClick={vm.onCancel}
                  className="w-full text-xs text-app-subtle"
                >
                  {copy.cancel}
                </button>
              )}
            </form>
          )}
          <Link href={vm.banksHref} className="block text-xs font-semibold text-app-members-count">
            {copy.titles.banks} →
          </Link>
        </>
      )}
      {vm.mode === "withdraw" && vm.operation && (
        <section className={`${card} space-y-4 py-8 text-center`}>
          <Hourglass size={42} className="mx-auto text-app-members-count" />
          <h2 className="text-2xl font-bold">{vm.operationTitle}</h2>
          <p className="text-xl font-bold text-app-members-count">{vm.operation.amount}</p>
          <p className="text-xs leading-relaxed text-app-subtle">{vm.operationNote}</p>
          <p className="break-all font-mono text-xs">{vm.operation.reference}</p>
          <Link className={button} href={vm.historyHref}>
            {copy.history}
          </Link>
        </section>
      )}
      {vm.mode === "pay" && vm.operation && (
        <>
          <section className={`${card} space-y-3 border-kink-gold-bright/35`}>
            <p className="text-xs text-app-subtle">{copy.amount}</p>
            <h2 className="text-3xl font-bold text-app-members-count">{vm.operation.amount}</h2>
            <p className="text-xs">
              {vm.operation.quantityLabel} {copy.labels[vm.operation.currency]}
            </p>
            <p className="text-sm font-bold">{vm.operation.bankName}</p>
            <p className="text-sm">{vm.operation.accountName}</p>
            <p className="select-all font-mono text-xl">{vm.operation.accountNumber}</p>
            <p className="break-all text-xs text-app-subtle">
              {copy.reference}: {vm.operation.reference}
            </p>
            <p className="text-xs font-semibold text-app-members-count">
              {vm.operation.statusLabel}
            </p>
          </section>
          {vm.operation.status === "pending" ? (
            <form
              className={`${card} space-y-4`}
              onSubmit={(event) => {
                event.preventDefault();
                vm.onSubmitProof();
              }}
            >
              <p className="text-xs leading-relaxed text-app-subtle">{copy.transfer}</p>
              <label className="block text-xs">
                {copy.sender}
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={vm.proof.senderAccountName}
                  onChange={(event) => vm.onProofField("senderAccountName", event.target.value)}
                  className={input}
                />
              </label>
              <label className="block text-xs">
                {copy.senderReference}
                <input
                  required
                  maxLength={100}
                  value={vm.proof.senderReference}
                  onChange={(event) => vm.onProofField("senderReference", event.target.value)}
                  className={input}
                />
              </label>
              <label className="block text-xs">
                {copy.receipt}
                <input
                  required
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => vm.onFile(event.target.files?.[0] ?? null)}
                  className={`${input} text-xs`}
                />
              </label>
              <button disabled={vm.busy || !vm.fileName} className={`${button} w-full`}>
                {copy.submitProof}
              </button>
            </form>
          ) : (
            <section className={card}>
              <p className="text-sm leading-relaxed">
                {vm.operation.status === "verified"
                  ? copy.verified
                  : vm.operation.status === "rejected"
                    ? copy.failed
                    : copy.waiting}
              </p>
              {vm.operation.reviewNote && (
                <p className="mt-3 text-sm text-red-500">{vm.operation.reviewNote}</p>
              )}
            </section>
          )}
          <Link
            href={vm.historyHref}
            className="block text-xs font-semibold text-app-members-count"
          >
            {copy.history} →
          </Link>
        </>
      )}
    </div>
  );
}
