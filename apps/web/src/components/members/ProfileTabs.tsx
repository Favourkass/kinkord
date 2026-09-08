export interface ProfileTabVM {
  key: string;
  label: string;
}

export interface ProfileTabsProps {
  tabs: ProfileTabVM[];
  active: string;
  onSelect: (key: string) => void;
}

/** Posts | About | Media | Friends — gold underline marks the active tab. */
export default function ProfileTabs({ tabs, active, onSelect }: ProfileTabsProps) {
  return (
    <div
      role="tablist"
      className="mx-auto mt-[18px] flex w-full max-w-[600px] border-b border-app-line"
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
            className={`-mb-px flex-1 border-b-2 pb-[10px] pt-[6px] text-[14px] font-semibold ${
              selected ? "border-kink-amber text-kink-amber" : "border-transparent text-app-subtle"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
