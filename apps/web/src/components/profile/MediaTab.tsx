export interface MediaTabProps {
  heading: string;
  countLabel: string;
  filters: Array<{ key: string; label: string; active: boolean }>;
  onFilter: (key: string) => void;
  photos: Array<{ id: string; url: string; featured?: boolean }>;
  featuredLabel: string;
  emptyText: string;
}

/** Figma Media tab (944:2651): "Photos" + count, filter pills, 3-column 4px grid with a featured tile. */
export default function MediaTab(p: MediaTabProps) {
  return (
    <div className="px-[12px] pb-[24px] pt-[12px]">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-bold leading-[25.5px] text-pf-text">{p.heading}</h2>
        <span className="text-[13px] leading-[19.5px] text-pf-pill-text">{p.countLabel}</span>
      </div>
      <div className="flex gap-[8px] pt-[12px]">
        {p.filters.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={f.active}
            onClick={() => p.onFilter(f.key)}
            className={`h-[31px] rounded-full px-[16px] text-[13px] leading-[19.5px] ${
              f.active
                ? "bg-kink-gold-bright font-semibold text-[#0a0a0a]"
                : "bg-pf-pill text-pf-pill-text"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {p.photos.length === 0 ? (
        <p className="pt-[16px] text-[13px] text-pf-muted">{p.emptyText}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-[4px] pt-[16px]">
          {p.photos.map((photo) => (
            <li
              key={photo.id}
              className={`relative overflow-hidden rounded-[8px] ${photo.featured ? "col-span-2 row-span-1 aspect-[2/1]" : "aspect-square"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" className="size-full object-cover" />
              {photo.featured && (
                <span className="absolute left-[8px] top-[8px] rounded-full bg-kink-gold-bright px-[8px] py-[2px] text-[10px] font-semibold leading-[15px] text-[#0a0a0a]">
                  {p.featuredLabel}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
