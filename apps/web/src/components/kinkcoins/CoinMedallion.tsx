import { Crown, Star } from "lucide-react";
import type { KinkCurrency } from "@/domain/kinkcoins";

/** Vector marks and CSS metal: crisp at every size, without raster backgrounds. */
export default function CoinMedallion({
  kind,
  className = "size-14",
}: {
  kind: KinkCurrency;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center rounded-full border-[3px] border-[#f9d568] bg-[linear-gradient(140deg,#fff19a_0%,#e9b933_28%,#916000_72%,#f7d057_100%)] shadow-[inset_0_0_0_3px_#a17416,inset_0_0_12px_#ffe89b,0_0_16px_#eebc3226] ${className}`}
    >
      <span className="grid h-[77%] w-[77%] place-items-center rounded-full border border-[#f9d568]/65 bg-[linear-gradient(145deg,#e7b532,#9a6503)] text-[#ffe773] drop-shadow-[0_2px_1px_#664202]">
        {kind === "coin" ? (
          <span className="text-[1.8em] font-black leading-none">K</span>
        ) : kind === "star" ? (
          <Star className="h-[65%] w-[65%]" fill="currentColor" strokeWidth={1} />
        ) : (
          <Crown className="h-[65%] w-[65%]" fill="currentColor" strokeWidth={1.4} />
        )}
      </span>
    </span>
  );
}
