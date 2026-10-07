import Link from "next/link";
import { ArrowLeft, Landmark, Plus, Trash2 } from "lucide-react";
import type { useBankAccountsPresenter } from "@/presenters/useBankAccountsPresenter";
export default function BankAccountsView({
  vm,
}: {
  vm: ReturnType<typeof useBankAccountsPresenter>;
}) {
  const { copy } = vm;
  const inputClass =
    "mt-1 w-full rounded-lg border border-app-card-border bg-app-surface px-3 py-2.5 text-sm text-app-text outline-none focus:border-kink-gold-bright";
  return (
    <div className="mx-auto w-full max-w-[600px] space-y-4 px-5 pb-8 pt-5 text-app-text">
      <Link
        href={vm.walletHref}
        className="hidden items-center gap-2 text-sm text-app-members-count lg:flex"
      >
        <ArrowLeft size={18} />
        {copy.back}
      </Link>
      <aside className="rounded-lg border border-kink-gold-bright/30 bg-kink-gold-bright/10 p-3 text-[11px] leading-relaxed text-app-subtle">
        <strong className="block text-app-members-count">{copy.preview}</strong>
        {copy.notice}
      </aside>
      <section>
        <h2 className="text-xl font-bold">{copy.heading}</h2>
        <p className="mt-2 text-xs leading-relaxed text-app-subtle">{copy.description}</p>
      </section>
      {vm.accounts.length === 0 ? (
        <section className="rounded-xl border border-app-card-border bg-app-card p-7 text-center">
          <Landmark size={34} className="mx-auto mb-3 text-app-members-count" aria-hidden="true" />
          <h3 className="text-sm font-bold">{copy.empty}</h3>
          <p className="mt-2 text-xs text-app-subtle">{copy.emptyHint}</p>
        </section>
      ) : (
        <ul className="space-y-3" aria-label={copy.heading}>
          {vm.accounts.map((account) => (
            <li
              key={account.id}
              className="rounded-xl border border-app-card-border bg-app-card p-4"
            >
              <div className="flex items-start gap-3">
                <Landmark
                  size={28}
                  className="shrink-0 text-app-members-count"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1 break-words">
                  <h3 className="text-sm font-bold">{account.bank}</h3>
                  <p className="mt-1 text-xs text-app-subtle">{account.holder}</p>
                  <p className="mt-1 text-xs text-app-subtle">{account.detail}</p>
                </div>
                {account.isDefault && (
                  <span className="rounded-full bg-kink-gold-bright/10 px-2 py-1 text-[10px] font-semibold text-app-members-count">
                    {copy.default}
                  </span>
                )}
              </div>
              <div className="mt-4 flex items-center justify-end gap-4 border-t border-app-card-border pt-3">
                {!account.isDefault && (
                  <button
                    type="button"
                    onClick={() => vm.onDefault(account.id)}
                    className="text-xs font-semibold text-app-members-count"
                  >
                    {copy.makeDefault}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => vm.onRemove(account.id)}
                  aria-label={`${copy.remove} ${account.bank} ${account.maskedNumber}`}
                  className="inline-flex items-center gap-1 text-xs text-app-subtle"
                >
                  <Trash2 size={14} />
                  {copy.remove}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          vm.onSave();
        }}
        className="space-y-4 rounded-xl border border-app-card-border bg-app-card p-4"
      >
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Plus size={20} className="text-app-members-count" />
          {copy.add}
        </h2>
        <label className="block text-xs font-semibold">
          {copy.bank}
          <input
            disabled={!vm.ready}
            value={vm.form.bank}
            onChange={(e) => vm.onChange("bank", e.target.value)}
            required
            minLength={2}
            maxLength={80}
            autoComplete="off"
            className={inputClass}
          />
        </label>
        <label className="block text-xs font-semibold">
          {copy.holder}
          <input
            disabled={!vm.ready}
            value={vm.form.holder}
            onChange={(e) => vm.onChange("holder", e.target.value)}
            required
            minLength={2}
            maxLength={100}
            autoComplete="off"
            className={inputClass}
          />
        </label>
        <label className="block text-xs font-semibold">
          {copy.number}
          <input
            disabled={!vm.ready}
            value={vm.form.number}
            onChange={(e) => vm.onChange("number", e.target.value)}
            required
            inputMode="numeric"
            pattern="[0-9]{6,20}"
            maxLength={20}
            autoComplete="off"
            className={inputClass}
          />
        </label>
        <label className="block text-xs font-semibold">
          {copy.type}
          <select
            disabled={!vm.ready}
            aria-label={copy.type}
            value={vm.form.type}
            onChange={(e) => vm.onChange("type", e.target.value)}
            className={inputClass}
          >
            <option value="Savings">{copy.savings}</option>
            <option value="Current">{copy.current}</option>
          </select>
        </label>
        {vm.error && (
          <p role="alert" className="text-xs text-red-500">
            {vm.error}
          </p>
        )}
        <button
          type="submit"
          disabled={!vm.ready}
          className="w-full rounded-full bg-[linear-gradient(#ffe380,#eabd31)] px-5 py-3 text-xs font-bold text-[#322200] disabled:opacity-50"
        >
          {copy.save}
        </button>
      </form>
      {vm.status && (
        <p role="status" className="text-xs text-app-members-count">
          {vm.status}
        </p>
      )}
    </div>
  );
}
