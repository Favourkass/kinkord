import type { MediaTileVM } from "@/domain/member";

export interface MediaLightboxVM {
  tile: MediaTileVM;
  /** Only your own photos can be deleted. */
  canDelete: boolean;
  confirming: boolean;
  deleting: boolean;
}

export interface MediaTabProps {
  heading: string;
  countLabel: string;
  filters: Array<{ key: string; label: string; active: boolean }>;
  onFilter: (key: string) => void;
  tiles: MediaTileVM[];
  featuredLabel: string;
  emptyText: string;
  loading: boolean;
  loadingText: string;
  onOpen: (tile: MediaTileVM) => void;
  lightbox: MediaLightboxVM | null;
  lightboxLabels: {
    close: string;
    delete: string;
    confirm: string;
    confirmYes: string;
    cancel: string;
    deleting: string;
    current: string;
  };
  onClose: () => void;
  onDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}

/**
 * Media tab (Figma 1524:1786): "Photos" + count, pills All · Profile Photo · Photos · Videos,
 * 3-column 4px grid with the current profile photo as the 2-column "Featured" tile. Tapping a
 * photo enlarges it; your own photos can be deleted from there (CEO, 2026-09-12).
 */
export default function MediaTab(p: MediaTabProps) {
  const lb = p.lightbox;
  return (
    <div className="px-[12px] pb-[24px] pt-[12px] lg:px-0">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-bold leading-[25.5px] text-pf-text">{p.heading}</h2>
        <span className="text-[13px] leading-[19.5px] text-pf-muted">{p.countLabel}</span>
      </div>
      <div className="flex flex-wrap gap-[8px] pt-[12px]">
        {p.filters.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={f.active}
            onClick={() => p.onFilter(f.key)}
            className={`h-[31px] rounded-full px-[16px] text-[13px] leading-[19.5px] ${
              f.active
                ? "bg-kink-gold-bright font-semibold text-[#0a0a0a]"
                : "border border-pf-border bg-pf-surface text-pf-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {p.loading ? (
        <p className="pt-[16px] text-[13px] text-pf-muted">{p.loadingText}</p>
      ) : p.tiles.length === 0 ? (
        <p className="pt-[16px] text-[13px] text-pf-muted">{p.emptyText}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-[4px] pt-[16px]">
          {p.tiles.map((tile) => (
            <li
              key={tile.id}
              className={`relative overflow-hidden rounded-[8px] bg-pf-surface-2 ${
                tile.featured ? "col-span-2 aspect-[2/1]" : "aspect-square"
              }`}
            >
              <button
                type="button"
                onClick={() => p.onOpen(tile)}
                className="block size-full"
                aria-label={tile.featured ? p.featuredLabel : undefined}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL */}
                <img
                  src={tile.url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover"
                />
              </button>
              {tile.featured ? (
                <span className="pointer-events-none absolute left-[8px] top-[8px] rounded-full bg-kink-gold-bright px-[8px] py-[2px] text-[10px] font-semibold leading-[15px] text-[#0a0a0a]">
                  {p.featuredLabel}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {lb ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex flex-col bg-black/95"
        >
          <div className="flex items-center justify-between px-[16px] pt-[max(12px,env(safe-area-inset-top))]">
            <span className="text-[12px] text-white/70">
              {lb.tile.isCurrent ? p.lightboxLabels.current : ""}
            </span>
            <button
              type="button"
              aria-label={p.lightboxLabels.close}
              onClick={p.onClose}
              className="grid size-[36px] place-items-center rounded-full bg-white/10 text-[22px] leading-none text-white"
            >
              ×
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-[16px]">
            {/* eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL */}
            <img src={lb.tile.fullUrl} alt="" className="max-h-full max-w-full object-contain" />
          </div>
          {lb.canDelete ? (
            <div className="flex flex-col items-center gap-[10px] px-[16px] pb-[max(20px,env(safe-area-inset-bottom))]">
              {lb.confirming ? (
                <>
                  <p className="text-center text-[13px] text-white/80">
                    {p.lightboxLabels.confirm}
                  </p>
                  <div className="flex gap-[10px]">
                    <button
                      type="button"
                      onClick={p.onCancelDelete}
                      disabled={lb.deleting}
                      className="h-[40px] rounded-[12px] border border-white/30 px-[18px] text-[13px] font-semibold text-white"
                    >
                      {p.lightboxLabels.cancel}
                    </button>
                    <button
                      type="button"
                      onClick={p.onConfirmDelete}
                      disabled={lb.deleting}
                      className="h-[40px] rounded-[12px] bg-red-600 px-[18px] text-[13px] font-bold text-white disabled:opacity-60"
                    >
                      {lb.deleting ? p.lightboxLabels.deleting : p.lightboxLabels.confirmYes}
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={p.onDelete}
                  className="flex h-[40px] items-center gap-[8px] rounded-[12px] border border-white/30 px-[18px] text-[13px] font-semibold text-white"
                >
                  {p.lightboxLabels.delete}
                </button>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
