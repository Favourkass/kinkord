import Link from "next/link";
import type { useWalletAdminPresenter } from "@/presenters/useWalletAdminPresenter";
const card = "rounded-xl border border-app-card-border bg-app-card p-4 text-app-text";
const button =
  "rounded-full bg-kink-gold-bright px-4 py-2 text-xs font-bold text-black disabled:opacity-40";
const input =
  "mt-1 w-full rounded-lg border border-app-card-border bg-app-surface p-2.5 text-sm text-app-text";
export default function WalletAdminView({
  vm,
}: {
  vm: ReturnType<typeof useWalletAdminPresenter>;
}) {
  const { copy } = vm;
  return (
    <div className="space-y-5 pt-5">
      <p className="text-sm leading-relaxed text-app-subtle">{copy.adminHint}</p>
      {vm.error && (
        <p role="alert" className="text-sm text-red-500">
          {vm.error}
        </p>
      )}
      {vm.notice && (
        <p role="status" className="text-sm text-app-members-count">
          {vm.notice}
        </p>
      )}
      <Link href={vm.bankHref} className="block text-sm font-semibold text-app-members-count">
        {copy.paymentBank} →
      </Link>
      {vm.canEdit && (
        <form
          className={`${card} space-y-4`}
          onSubmit={(event) => {
            event.preventDefault();
            vm.onSave();
          }}
        >
          <h2 className="font-bold">{copy.settings}</h2>
          <div className="grid grid-cols-2 gap-4">
            {(["coin", "star", "crown"] as const).map((currency) => (
              <div key={currency} className="col-span-2 grid grid-cols-2 gap-3">
                <label className="text-xs">
                  {copy.labels[currency]} · {copy.purchaseRate}
                  <input
                    required
                    inputMode="decimal"
                    value={vm.form[`${currency}Buy`]}
                    onChange={(event) => vm.onField(`${currency}Buy`, event.target.value)}
                    className={input}
                  />
                </label>
                <label className="text-xs">
                  {copy.labels[currency]} · {copy.redeemRate}
                  <input
                    required
                    inputMode="decimal"
                    value={vm.form[`${currency}Redeem`]}
                    onChange={(event) => vm.onField(`${currency}Redeem`, event.target.value)}
                    className={input}
                  />
                </label>
              </div>
            ))}
          </div>
          <label className="block text-xs">
            {copy.minimumSetting}
            <input
              required
              inputMode="decimal"
              value={vm.form.minimum}
              onChange={(event) => vm.onField("minimum", event.target.value)}
              className={input}
            />
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={vm.form.enabled}
              onChange={(event) => vm.onEnabled(event.target.checked)}
            />
            {copy.enabled}
          </label>
          <button disabled={vm.busy} className={button}>
            {copy.saveSettings}
          </button>
        </form>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Request type"
          value={vm.kind}
          onChange={(event) => vm.onKind(event.target.value as "purchase" | "withdrawal")}
          className="rounded-lg border border-app-card-border bg-app-card p-2 text-sm text-app-text"
        >
          <option value="purchase">{copy.incoming}</option>
          <option value="withdrawal">{copy.outgoing}</option>
        </select>
        <select
          aria-label="Request status"
          value={vm.status}
          onChange={(event) => vm.onStatus(event.target.value)}
          className="rounded-lg border border-app-card-border bg-app-card p-2 text-sm text-app-text"
        >
          <option value="">{copy.all}</option>
          {["pending", "submitted", "verified", "approved", "paid", "rejected"].map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={vm.busy}
          onClick={vm.onRefresh}
          className="text-xs text-app-members-count"
        >
          {copy.retry}
        </button>
      </div>
      {!vm.rows.length && <p className="text-sm text-app-subtle">{copy.emptyQueue}</p>}
      {vm.rows.map((row) => (
        <article key={row.id} className={`${card} space-y-3`}>
          <div className="flex justify-between gap-3">
            <h2 className="font-bold text-app-members-count">{row.amount}</h2>
            <span className="text-xs">{row.statusLabel}</span>
          </div>
          <p className="text-xs">
            {row.quantityLabel} {copy.labels[row.currency]} · {row.date}
          </p>
          <p className="break-all font-mono text-xs">{row.reference}</p>
          <p className="text-xs text-app-subtle">
            {copy.bank}: {row.bankName}
            <br />
            {row.accountName}
            <br />
            {row.accountNumber}
          </p>
          {row.senderAccountName && (
            <p className="text-xs text-app-subtle">
              {copy.sender}: {row.senderAccountName}
              <br />
              {copy.senderReference}: {row.senderReference}
            </p>
          )}
          {row.receiptUrl && (
            <a
              href={row.receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs font-bold text-app-members-count"
            >
              {copy.receipt} ↗
            </a>
          )}
          {row.reviewNote && <p className="text-xs text-red-500">{row.reviewNote}</p>}
          {row.settlementReference && (
            <p className="break-all text-xs">
              {copy.bankReference}: {row.settlementReference}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {row.kind === "purchase" && row.status === "submitted" && (
              <button
                disabled={vm.busy}
                type="button"
                onClick={() => vm.onAsk(row.id, "verify")}
                className={button}
              >
                {copy.verify}
              </button>
            )}
            {row.kind === "withdrawal" && row.status === "pending" && (
              <button
                disabled={vm.busy}
                type="button"
                onClick={() => vm.onAsk(row.id, "approve")}
                className={button}
              >
                {copy.approve}
              </button>
            )}
            {row.kind === "withdrawal" && row.status === "approved" && (
              <button
                disabled={vm.busy}
                type="button"
                onClick={() => vm.onAsk(row.id, "paid")}
                className={button}
              >
                {copy.markPaid}
              </button>
            )}
            {((row.kind === "purchase" &&
              (row.status === "submitted" || row.status === "pending")) ||
              (row.kind === "withdrawal" &&
                (row.status === "pending" || row.status === "approved"))) && (
              <button
                disabled={vm.busy}
                type="button"
                onClick={() => vm.onAsk(row.id, "reject")}
                className="rounded-full border border-red-500/40 px-4 py-2 text-xs text-red-500"
              >
                {copy.reject}
              </button>
            )}
          </div>
        </article>
      ))}
      {vm.dialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-5">
          <form
            role="dialog"
            aria-modal="true"
            aria-label={vm.dialog.title}
            className={`${card} w-full max-w-md space-y-4`}
            onSubmit={(event) => {
              event.preventDefault();
              vm.onDecide();
            }}
          >
            <h2 className="text-lg font-bold">{vm.dialog.title}</h2>
            <p className="text-sm leading-relaxed text-app-subtle">{vm.dialog.hint}</p>
            {vm.error && (
              <p role="alert" className="text-sm text-red-500">
                {vm.error}
              </p>
            )}
            {vm.dialog.action !== "approve" && (
              <label className="block text-xs">
                {vm.dialog.action === "reject" ? copy.reason : copy.bankReference}
                <input
                  required
                  minLength={3}
                  maxLength={vm.dialog.action === "reject" ? 300 : 100}
                  value={vm.dialog.detail}
                  onChange={(event) => vm.onDetail(event.target.value)}
                  className={input}
                />
              </label>
            )}
            <div className="flex justify-end gap-3">
              <button type="button" disabled={vm.busy} onClick={vm.onCancel} className="text-xs">
                {copy.cancel}
              </button>
              <button disabled={vm.busy} className={button}>
                {copy.decisionConfirm}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
