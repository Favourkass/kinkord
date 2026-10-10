import Link from "next/link";
import { Coins, Crown, Star, X } from "lucide-react";
import type { KinkCurrency } from "@/domain/kinkcoins";
export interface GiftDialogProps {
  open: boolean;
  recipient: string;
  currency: KinkCurrency;
  quantity: string;
  availableLabel: string;
  confirmLabel: string;
  buyHref: string;
  loading: boolean;
  locked: boolean;
  sending: boolean;
  canSend: boolean;
  error: string | null;
  copy: {
    title: string;
    currency: string;
    amount: string;
    close: string;
    loading: string;
    sending: string;
    buy: string;
    notice: string;
    labels: Record<KinkCurrency, string>;
  };
  onCurrency: (value: KinkCurrency) => void;
  onQuantity: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
}
export default function GiftDialog(p: GiftDialogProps) {
  if (!p.open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={p.copy.title}
      className="fixed inset-0 z-[135] grid place-items-center bg-black/65 p-5"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          p.onSend();
        }}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-app-card-border bg-app-card p-5 text-app-text shadow-xl"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{p.copy.title}</h2>
          <button
            type="button"
            onClick={p.onClose}
            disabled={p.sending}
            aria-label={p.copy.close}
            className="p-2 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>
        <p className="text-sm font-semibold">{p.recipient}</p>
        <fieldset disabled={p.sending || p.loading || p.locked}>
          <legend className="mb-2 text-xs text-app-subtle">{p.copy.currency}</legend>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { kind: "coin", Icon: Coins },
                { kind: "star", Icon: Star },
                { kind: "crown", Icon: Crown },
              ] as const
            ).map(({ kind, Icon }) => (
              <button
                key={kind}
                type="button"
                aria-pressed={p.currency === kind}
                onClick={() => p.onCurrency(kind)}
                className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-xs font-bold ${p.currency === kind ? "border-kink-gold-bright bg-kink-gold-bright text-black" : "border-app-card-border text-app-members-count"}`}
              >
                <Icon size={24} aria-hidden="true" />
                {p.copy.labels[kind]}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block space-y-2 text-sm font-semibold">
          <span>{p.copy.amount}</span>
          <input
            type="number"
            min="1"
            max="1000000"
            step="1"
            inputMode="numeric"
            value={p.quantity}
            onChange={(e) => p.onQuantity(e.target.value)}
            disabled={p.sending || p.loading || p.locked}
            className="w-full rounded-lg border border-app-card-border bg-app-surface px-3 py-3 text-app-text"
          />
        </label>
        <p className="text-xs text-app-subtle">{p.loading ? p.copy.loading : p.availableLabel}</p>
        <p className="text-xs leading-relaxed text-app-subtle">{p.copy.notice}</p>
        {p.error && (
          <p role="alert" className="text-sm text-red-500">
            {p.error}
          </p>
        )}
        <button
          type="submit"
          disabled={!p.canSend}
          className="w-full rounded-full bg-kink-gold-bright px-4 py-3 text-sm font-bold text-black disabled:opacity-40"
        >
          {p.sending ? p.copy.sending : p.confirmLabel}
        </button>
        {!p.sending && (
          <Link
            href={p.buyHref}
            className="block text-center text-sm font-semibold text-app-members-count"
          >
            {p.copy.buy}
          </Link>
        )}
      </form>
    </div>
  );
}
