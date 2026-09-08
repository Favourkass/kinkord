import Link from "next/link";
import MaskIcon from "@/components/app/MaskIcon";

export interface ProfileNavBarProps {
  brand: string;
  searchHref: string;
  labels: { search: string; more: string; share: string };
  onMore: () => void;
  onShare: () => void;
}

/** Figma profile NavBar: KINKORD (Inter Black 22) left, three 32px icon circles right. */
export default function ProfileNavBar({
  brand,
  searchHref,
  labels,
  onMore,
  onShare,
}: ProfileNavBarProps) {
  const circle =
    "grid size-[32px] place-items-center rounded-[20px] border border-pf-border bg-pf-surface-2 text-pf-icon";
  return (
    <header className="flex h-[56px] shrink-0 items-center justify-between border-b border-pf-border bg-pf-nav px-[16px]">
      <p className="text-[22px] font-black leading-none tracking-[0.88px] text-kink-gold-bright">
        {brand}
      </p>
      <div className="flex items-center gap-[10px]">
        <Link href={searchHref} aria-label={labels.search} className={circle}>
          <MaskIcon name="nav-search" width={16} />
        </Link>
        <button type="button" aria-label={labels.more} onClick={onMore} className={circle}>
          <MaskIcon name="nav-more" width={16} />
        </button>
        <button type="button" aria-label={labels.share} onClick={onShare} className={circle}>
          <MaskIcon name="nav-share" width={16} />
        </button>
      </div>
    </header>
  );
}
