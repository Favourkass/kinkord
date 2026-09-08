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
      className="flex items-end justify-evenly border-b border-pf-border px-[10px] lg:justify-start lg:gap-[8px] lg:px-0"
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
            className={`h-[26px] border-b-[1.5px] text-[15px] font-medium leading-[18px] lg:h-auto lg:border-b-2 lg:px-[16px] lg:py-[8px] ${
              selected
                ? "border-kink-gold-bright text-kink-gold-bright lg:font-bold"
                : "border-transparent text-pf-muted"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
