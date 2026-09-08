import { Check, ChevronDown, MapPin } from "lucide-react";

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
}

/**
 * Tap-only region picker (CEO brief: no typing). The trigger shows the current
 * region; tapping opens a scrollable sheet of the state's configured regions.
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
}: RegionSelectorProps) {
  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${value}`}
        className="flex h-[52px] w-full items-center gap-[10px] rounded-[14px] border border-kink-amber/60 bg-app-card px-[14px] text-left"
      >
        <MapPin size={20} className="shrink-0 text-kink-amber" aria-hidden />
        <span className="flex-1 truncate text-[17px] font-semibold text-app-text">{value}</span>
        <ChevronDown size={20} className="shrink-0 text-kink-amber" aria-hidden />
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
            className="absolute inset-x-0 bottom-0 max-h-[70dvh] overflow-y-auto rounded-t-[24px] border-t-2 border-kink-amber/70 bg-app-drawer pb-[max(16px,env(safe-area-inset-bottom))] lg:inset-auto lg:left-1/2 lg:top-1/2 lg:w-[420px] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-[24px] lg:border-2"
          >
            <p className="px-[20px] pb-[6px] pt-[18px] text-[13px] font-bold uppercase tracking-[2px] text-kink-amber">
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
                  className={`flex h-[50px] w-full items-center justify-between px-[20px] text-left text-[16px] ${
                    selected ? "font-bold text-kink-amber" : "text-app-name"
                  }`}
                >
                  {option}
                  {selected && <Check size={18} aria-hidden />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
