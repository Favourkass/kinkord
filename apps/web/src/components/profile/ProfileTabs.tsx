export interface ProfileTabVM {
  key: string;
  label: string;
}

export interface ProfileTabsProps {
  tabs: ProfileTabVM[];
  active: string;
  onSelect: (key: string) => void;
}

/**
 * Posts | About | Media | Friends. Mobile: Medium 15, evenly spread, 1.5px gold underline.
 * Desktop: left-aligned, px16 py8, Bold gold with a 2px underline.
 */
export default function ProfileTabs({ tabs, active, onSelect }: ProfileTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Profile sections"
      className="mx-auto flex w-full max-w-[440px] items-center justify-between border-b border-neutral-800/70 px-[20px] lg:max-w-none lg:justify-start lg:gap-[16px] lg:px-[16px]"
    >
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(tab.key)}
            className={`relative pb-[10px] pt-[6px] text-[15px] transition-colors lg:px-[12px] ${
              selected
                ? "font-bold text-kink-gold-bright"
                : "font-medium text-neutral-400 hover:text-white"
            }`}
          >
            {tab.label}
            {selected && (
              <span
                aria-hidden
                className="absolute bottom-0 left-1/2 h-[2.5px] w-[46px] -translate-x-1/2 rounded-full bg-kink-gold-bright"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
