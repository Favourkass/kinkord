import MaskIcon from "@/components/app/MaskIcon";
import type { MemberCardVM, RegionRowVM } from "@/domain/member";
import InfiniteSentinel from "./InfiniteSentinel";
import MemberCard, { type MemberCardLabels } from "./MemberCard";
import RegionSelector, { type RegionSelectorProps } from "./RegionSelector";

export interface RegionListProps {
  title: string;
  subtitle: string;
  selector: RegionSelectorProps;
  /** "256" */
  count: string;
  foundLabel: string;
  sortLabel: string;
  sortAria: string;
  onSort: () => void;
  viewListLabel: string;
  rows: RegionRowVM[];
  cardLabels: Omit<MemberCardLabels, "openProfile">;
  onToggleFollow: (card: MemberCardVM) => void;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  loadingMoreText: string;
  endText: string | null;
  empty: string | null;
  error: string | null;
  unknownState: string | null;
}

/** "Delta State" members list — Figma 907:1410/1517 (mobile) and 907:1624 (PC). */
export default function RegionList(p: RegionListProps) {
  return (
    <div className="flex w-full flex-1 flex-col px-[18px] lg:max-w-[887px] lg:px-0">
      <h1 className="pt-[30px] text-[28px] font-bold leading-[34px] text-mem-title lg:pt-[28px] lg:text-[48px] lg:leading-[46px]">
        {p.title}
      </h1>
      <p className="pt-[6px] text-[14px] font-medium leading-[17px] text-mem-muted lg:pt-[20px] lg:text-[24px] lg:leading-[29px] lg:text-mem-subtitle">
        {p.subtitle}
      </p>
      {p.unknownState ? (
        <p className="pt-[28px] text-[15px] text-mem-muted lg:text-[20px]">{p.unknownState}</p>
      ) : (
        <>
          <div className="pt-[14px] lg:pt-[18px]">
            <RegionSelector {...p.selector} />
          </div>
          <div className="flex items-center pt-[26px] lg:pt-[47px]">
            <span className="text-[14px] font-medium text-mem-list-text lg:text-[20px]">
              {p.count}
            </span>
            <span className="pl-[8px] text-[14px] font-medium text-mem-list-muted lg:pl-[10px] lg:text-[20px]">
              {p.foundLabel}
            </span>
            <button
              type="button"
              onClick={p.onSort}
              aria-label={p.sortAria}
              className="ml-auto flex items-center text-[14px] font-medium text-kink-gold-bright lg:text-[20px]"
            >
              {p.sortLabel}
              <span className="ml-[8px] lg:hidden">
                <MaskIcon name="sort" width={18} />
              </span>
              <span className="ml-[8px] hidden lg:block">
                <MaskIcon name="sort" width={23} />
              </span>
            </button>
            <span aria-hidden className="mx-[7px] h-[14px] w-px bg-mem-list-border lg:h-[18px]" />
            <span className="text-mem-muted" aria-label={p.viewListLabel} role="img">
              <span className="lg:hidden">
                <MaskIcon name="list" width={18} />
              </span>
              <span className="hidden lg:block">
                <MaskIcon name="list" width={22} />
              </span>
            </span>
          </div>

          {p.error && (
            <p className="pt-[12px] text-[14px] text-mem-muted lg:text-[20px]">{p.error}</p>
          )}
          {p.empty && (
            <p className="pt-[20px] text-[14px] text-mem-muted lg:text-[20px]">{p.empty}</p>
          )}

          <ul className="flex flex-col gap-[7px] pt-[18px] lg:gap-[22px] lg:pt-[32px]">
            {p.rows.map((row) => (
              <li key={row.card.userId}>
                <MemberCard
                  vm={row.card}
                  href={row.href}
                  labels={{ ...p.cardLabels, openProfile: row.openProfileLabel }}
                  onToggleFollow={() => p.onToggleFollow(row.card)}
                  busy={row.busy}
                />
              </li>
            ))}
          </ul>

          <InfiniteSentinel
            onVisible={p.loadMore}
            enabled={p.hasMore && !p.loading}
            loading={p.loading || p.loadingMore}
            loadingText={p.loadingMoreText}
            endText={p.endText}
          />
        </>
      )}
    </div>
  );
}
