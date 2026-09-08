import MaskIcon from "@/components/app/MaskIcon";

export interface MembersSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  /** Figma draws the search glyph at 24px on the country page and 26px on the state page. */
  iconSize?: 24 | 26;
}

/** Figma search field: 43px tall (64px on desktop), radius 8 (12), glyph 16px (38px) in. */
export default function MembersSearch({
  value,
  onChange,
  placeholder,
  label,
  iconSize = 24,
}: MembersSearchProps) {
  return (
    <label className="relative block h-[43px] lg:h-[64px]">
      <span className="pointer-events-none absolute left-[16px] top-1/2 -translate-y-1/2 text-mem-search-icon lg:left-[38px]">
        <span className="lg:hidden">
          <MaskIcon name="search" width={iconSize} />
        </span>
        <span className="hidden lg:block">
          <MaskIcon name="search" width={32} />
        </span>
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        className="h-full w-full rounded-[8px] border border-mem-card-border bg-mem-card pl-[51px] pr-[14px] text-[14px] font-medium text-mem-text outline-none placeholder:text-mem-placeholder lg:rounded-[12px] lg:pl-[89px] lg:text-[24px]"
      />
    </label>
  );
}
