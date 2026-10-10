import { Coins } from "lucide-react";
import type { CoinBalanceVM } from "@/domain/kinkcoins";

export default function CoinBalance({ balance }: { balance: CoinBalanceVM }) {
  return (
    <span
      title={balance.description}
      aria-label={`${balance.amount} ${balance.label}. ${balance.description}`}
      className="inline-flex items-center gap-2 rounded-full border border-kink-gold-bright/30 bg-kink-gold-bright/10 px-3 py-1.5 text-xs font-semibold text-pf-text"
    >
      <Coins size={16} className="text-app-members-count" aria-hidden="true" />
      <span>
        {balance.amount} {balance.label}
      </span>
      <span className="text-[10px] font-normal text-pf-muted">{balance.status}</span>
    </span>
  );
}
