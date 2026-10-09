import { useId } from "react";
import {
  ChevronDown,
  ChevronRight,
  CreditCard,
  Landmark,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import type { useWalletPresenter } from "@/presenters/useWalletPresenter";
import BankLogo from "./BankLogo";
interface Props {
  vm: ReturnType<typeof useWalletPresenter>;
}
const field =
  "mt-1.5 w-full rounded-lg border border-app-card-border bg-app-surface px-4 py-3.5 text-sm text-app-text outline-none focus:border-kink-gold-bright disabled:opacity-50";
export default function BankAccountsView({ vm }: Props) {
  const { copy } = vm;
  const bankLabelId = useId();
  const disabled = vm.loading || vm.busy || vm.bankLimitReached;
  return (
    <div className="space-y-4">
      <section className="flex gap-4 rounded-xl border border-kink-gold-bright/40 bg-kink-gold-bright/5 p-4 sm:p-5">
        <ShieldCheck size={38} strokeWidth={1.6} className="mt-1 shrink-0 text-app-members-count" />
        <div>
          <h2 className="text-base font-bold text-app-members-count">{copy.safetyTitle}</h2>
          <p className="mt-1 text-xs leading-relaxed text-app-subtle sm:text-sm">
            {copy.bankNotice}
          </p>
        </div>
      </section>
      <form
        className="space-y-6 rounded-xl border border-app-card-border bg-app-card p-4 sm:p-5"
        onSubmit={(event) => {
          event.preventDefault();
          vm.onSaveBank();
        }}
      >
        <h2 className="text-lg font-bold">{copy.addBank}</h2>
        <div className="flex gap-3">
          <UserRound size={25} className="mt-6 shrink-0 text-app-members-count" />
          <label className="min-w-0 flex-1 text-xs font-medium sm:text-sm">
            {copy.holder}
            <input
              required
              minLength={2}
              maxLength={100}
              disabled={disabled}
              autoComplete="name"
              value={vm.bankForm.accountName}
              onChange={(event) => vm.onBankField("accountName", event.target.value)}
              className={field}
            />
            <span className="mt-2 block text-[10px] font-normal leading-relaxed text-app-subtle sm:text-xs">
              {copy.holderHelp}
            </span>
          </label>
        </div>
        <div className="flex gap-3">
          <Landmark size={25} className="mt-6 shrink-0 text-app-members-count" />
          <div className="relative min-w-0 flex-1">
            <label id={bankLabelId} className="text-xs font-medium sm:text-sm">
              {copy.bankPickerLabel} <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              disabled={disabled}
              aria-labelledby={bankLabelId}
              aria-haspopup="dialog"
              aria-expanded={vm.bankPickerOpen}
              onClick={vm.bankPickerOpen ? vm.onCloseBankPicker : vm.onOpenBankPicker}
              className={`${field} flex items-center gap-3 text-left`}
            >
              {vm.selectedBankOption && (
                <BankLogo src={vm.selectedBankOption.logo} className="size-7" />
              )}
              <span
                className={`min-w-0 flex-1 truncate ${vm.bankForm.bankName ? "" : "text-app-subtle"}`}
              >
                {vm.bankForm.bankName || copy.chooseBank}
              </span>
              <ChevronDown size={18} className="shrink-0 text-app-subtle" />
            </button>
            {vm.bankPickerOpen && (
              <div
                role="dialog"
                aria-label={copy.bankPickerLabel}
                onKeyDown={(event) => {
                  if (event.key === "Escape") vm.onCloseBankPicker();
                }}
                className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-app-card-border bg-app-card shadow-xl"
              >
                <div className="flex items-center gap-2 border-b border-app-card-border p-3">
                  <Search size={17} className="shrink-0 text-app-subtle" />
                  <input
                    aria-label={copy.bankSearch}
                    placeholder={copy.bankSearchPlaceholder}
                    value={vm.bankSearch}
                    onChange={(event) => vm.onBankSearch(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-sm text-app-text outline-none"
                  />
                  <button
                    type="button"
                    onClick={vm.onCloseBankPicker}
                    aria-label={copy.cancel}
                    className="p-1"
                  >
                    <X size={17} />
                  </button>
                </div>
                <div
                  role="listbox"
                  aria-label={copy.bankPickerLabel}
                  className="max-h-64 overflow-y-auto overscroll-contain"
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                    const options = Array.from(
                      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'),
                    );
                    const at = options.indexOf(event.target as HTMLButtonElement);
                    const next =
                      event.key === "ArrowDown"
                        ? Math.min(at + 1, options.length - 1)
                        : Math.max(at - 1, 0);
                    event.preventDefault();
                    options[next]?.focus();
                  }}
                >
                  {vm.bankOptions.map((bank) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={vm.bankForm.bankName === bank.name}
                      key={`${bank.code}:${bank.name}`}
                      onClick={() => vm.onChooseBank(bank.name)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-xs hover:bg-kink-gold-bright/10 focus:bg-kink-gold-bright/10 focus:outline-none"
                    >
                      <BankLogo src={bank.logo} className="size-9" />
                      <span className="min-w-0 flex-1">{bank.name}</span>
                    </button>
                  ))}
                  {!vm.bankOptions.length && (
                    <p className="p-4 text-xs text-app-subtle">{copy.noBankResults}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <CreditCard size={25} className="mt-6 shrink-0 text-app-members-count" />
          <label className="min-w-0 flex-1 text-xs font-medium sm:text-sm">
            {copy.number} <span className="text-red-500">*</span>
            <input
              required
              inputMode="numeric"
              pattern="[0-9]{10}"
              maxLength={10}
              autoComplete="off"
              placeholder={copy.accountPlaceholder}
              disabled={disabled}
              value={vm.bankForm.accountNumber}
              onChange={(event) => vm.onBankField("accountNumber", event.target.value)}
              className={field}
            />
          </label>
        </div>
        {vm.bankLimitReached && (
          <p role="status" className="text-xs text-app-subtle">
            {copy.bankLimitReached}
          </p>
        )}
        <button
          disabled={disabled || !vm.bankForm.bankName}
          className="w-full rounded-lg bg-[linear-gradient(#ffcf57,#ffbc24)] px-4 py-3.5 text-sm font-bold text-black disabled:opacity-40"
        >
          {copy.saveBank}
        </button>
      </form>
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">{copy.yourBanks}</h2>
          <span className="text-xs text-app-subtle">
            {vm.banks.length} / {vm.bankLimit}
          </span>
        </div>
        {!vm.banks.length && !vm.loading && (
          <p className="rounded-xl border border-app-card-border p-4 text-xs text-app-subtle">
            {copy.noBanks}
          </p>
        )}
        {vm.banks.map((bank) => (
          <article
            key={bank.id}
            className="flex items-center gap-3 rounded-xl border border-app-card-border bg-app-card p-4"
          >
            <BankLogo src={bank.logo} className="size-14" />
            <div className="min-w-0 flex-1">
              <h3 className="text-xs font-semibold sm:text-sm">{bank.bankName}</h3>
              <p className="mt-1 text-xs text-app-subtle">{bank.maskedNumber}</p>
              <p className="mt-0.5 text-[10px] text-app-subtle sm:text-xs">{bank.accountName}</p>
              {bank.default && (
                <span className="mt-1 block text-[9px] text-app-members-count">{copy.default}</span>
              )}
            </div>
            {!bank.default && (
              <button
                type="button"
                disabled={vm.busy}
                onClick={() => vm.onDefaultBank(bank.id)}
                aria-label={`${copy.makeDefault}: ${bank.bankName}`}
                className="p-1.5 text-app-subtle"
              >
                <ChevronRight size={20} />
              </button>
            )}
            <button
              type="button"
              disabled={vm.busy}
              onClick={() => vm.onRemoveBank(bank.id)}
              aria-label={`${copy.remove} ${bank.bankName} ${bank.maskedNumber}`}
              className="p-1.5 text-red-500"
            >
              <Trash2 size={20} />
            </button>
          </article>
        ))}
      </section>
      <p className="pb-2 pt-2 text-center text-[10px] text-app-subtle sm:text-xs">
        {copy.bankLimitHint}
      </p>
    </div>
  );
}
