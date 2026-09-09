import MaskIcon from "@/components/app/MaskIcon";

export interface RegionSelectorProps {
  label: string;
  value: string;
  options: readonly string[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSelect: (region: string) => void;
  sheetTitle: string;
  closeLabel: string;
  searchByRegionLabel: string;
}

/**
 * Figma 907:1410 / 907:1624: a pill dropdown (location glyph + region + chevron) and a
 * gold "Search by Region" link underneath. Both open the tap-only region sheet.
 */
export default function RegionSelector({
  label,
  value,
  options,
  open,
  onOpen,
  onClose,
  onSelect,
  sheetTitle,
  closeLabel,
  searchByRegionLabel,
}: RegionSelectorProps) {
  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${value}`}
        className="flex h-[48px] w-[309px] max-w-full items-center rounded-[50px] border border-mem-dropdown-border bg-mem-dropdown pl-[16px] pr-[20px] text-left lg:h-[54px] lg:w-[502px] lg:pr-[41px]"
      >
        <span className="shrink-0 text-kink-gold-bright">
          <span className="lg:hidden">
            <MaskIcon name="location-outline" width={24} />
          </span>
          <span className="hidden lg:block">
            <MaskIcon name="location-outline" width={32} />
          </span>
        </span>
        <span className="truncate pl-[9px] text-[13px] font-medium text-mem-list-text lg:pl-[12px] lg:text-[24px]">
          {value}
        </span>
        <span className="ml-auto shrink-0 rotate-90 text-mem-chevron">
          <span className="lg:hidden">
            <MaskIcon name="chevron-right-24" width={24} />
          </span>
          <span className="hidden lg:block">
            <MaskIcon name="chevron-right-24" width={32} />
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="mt-[14px] flex items-center gap-[4px] text-[14px] font-medium text-kink-gold-bright lg:mt-[20px] lg:gap-[9px] lg:text-[20px]"
      >
        <span className="lg:hidden">
          <MaskIcon name="filter" width={24} />
        </span>
        <span className="hidden lg:block">
          <MaskIcon name="filter" width={26} />
        </span>
        {searchByRegionLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            className="absolute inset-0 bg-black/60"
          />
          <div
            role="listbox"
            aria-label={sheetTitle}
            className="absolute inset-x-0 bottom-0 max-h-[70dvh] overflow-y-auto rounded-t-[24px] border-t border-mem-list-border bg-mem-card pb-[max(16px,env(safe-area-inset-bottom))] lg:inset-auto lg:left-1/2 lg:top-1/2 lg:w-[420px] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-[24px] lg:border"
          >
            <p className="px-[20px] pb-[6px] pt-[18px] text-[12px] font-extrabold uppercase tracking-[1px] text-kink-gold-bright">
              {sheetTitle}
            </p>
            {options.map((option) => {
              const selected = option === value;
              return (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => onSelect(option)}
                  className={`flex h-[48px] w-full items-center justify-between px-[20px] text-left text-[14px] ${
                    selected ? "font-bold text-kink-gold-bright" : "font-medium text-mem-text"
                  }`}
                >
                  {option}
                  {selected && (
                    <MaskIcon name="chevron-right-14" width={14} className="rotate-90" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
