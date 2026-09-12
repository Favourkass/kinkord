import Link from "next/link";
import MaskIcon from "@/components/app/MaskIcon";
import type { FriendRowVM } from "@/domain/member";

export interface PeopleRowVM extends FriendRowVM {
  /** Their profile. */
  href: string;
  /** "Friends" pill instead of a Follow button (your own friends list). */
  pill: boolean;
}

export interface PeopleTabProps {
  subTabs: Array<{ key: string; label: string; active: boolean }>;
  onSubTab: (key: string) => void;
  rows: PeopleRowVM[];
  labels: { follow: string; following: string; friendsPill: string; more: string };
  onToggleFollow: (row: PeopleRowVM) => void;
  loading: boolean;
  loadingText: string;
  empty: string | null;
  error: string | null;
  /** "See more" → the full list page; null when everything already fits. */
  seeMoreHref: string | null;
  seeMoreLabel: string;
  /** Extra footer (infinite-scroll sentinel on the full page). */
  footer?: React.ReactNode;
}

/**
 * People tab (Figma 1321:14 / 1319:672): sub-tabs Friends · Followers · Following · Suggested,
 * 48px rows with a "Friends" pill or Follow button, "See more" underneath.
 */
export default function PeopleTab(p: PeopleTabProps) {
  return (
    <div className="mx-[16px] mt-[16px] flex flex-col gap-[16px] rounded-[12px] border border-pf-border bg-pf-surface p-[16px] lg:mx-0">
      <div
        role="tablist"
        className="flex items-center justify-between gap-[6px] overflow-x-auto border-b border-pf-border pb-[8px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {p.subTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.active}
            onClick={() => p.onSubTab(t.key)}
            className={`whitespace-nowrap py-[4px] text-[12px] font-medium lg:text-[13px] ${
              t.active ? "text-kink-gold-bright" : "text-pf-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <ul className="flex flex-col">
        {p.rows.map((r) => (
          <li key={r.userId} className="flex items-center justify-between gap-[8px] py-[12px]">
            <Link href={r.href} className="flex min-w-0 items-center gap-[12px]">
              <span className="block size-[48px] shrink-0 overflow-hidden rounded-[24px] bg-pf-surface-2">
                {r.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL
                  <img
                    src={r.avatarUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="grid size-full place-items-center text-pf-muted">
                    <MaskIcon name="people" width={20} />
                  </span>
                )}
              </span>
              <span className="flex min-w-0 flex-col gap-[2px]">
                <span className="truncate text-[13px] font-bold leading-[16px] text-pf-text">
                  {r.displayName}
                </span>
                {r.handle ? (
                  <span className="truncate text-[11px] leading-[13px] text-pf-muted">
                    {r.handle}
                  </span>
                ) : null}
              </span>
            </Link>
            <span className="flex shrink-0 items-center gap-[8px]">
              {r.pill ? (
                <span className="rounded-[8px] bg-pf-pill px-[12px] py-[6px] text-[12px] font-semibold text-pf-pill-text">
                  {p.labels.friendsPill}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => p.onToggleFollow(r)}
                  disabled={r.busy}
                  aria-pressed={r.isFollowing}
                  className={`flex items-center gap-[4px] rounded-[8px] px-[12px] py-[6px] text-[12px] font-semibold disabled:opacity-60 ${
                    r.isFollowing
                      ? "border border-pf-border text-pf-muted"
                      : "bg-kink-gold-bright text-black"
                  }`}
                >
                  {r.isFollowing ? p.labels.following : p.labels.follow}
                </button>
              )}
              <span className="p-[6px] text-pf-muted" role="img" aria-label={p.labels.more}>
                <MaskIcon name="more-vertical" width={16} />
              </span>
            </span>
          </li>
        ))}
      </ul>
      {p.loading ? <p className="text-[13px] text-pf-muted">{p.loadingText}</p> : null}
      {p.empty ? <p className="text-[13px] text-pf-muted">{p.empty}</p> : null}
      {p.error ? <p className="text-[13px] text-pf-muted">{p.error}</p> : null}
      {p.seeMoreHref ? (
        <Link
          href={p.seeMoreHref}
          className="flex items-center justify-center gap-[8px] py-[8px] text-[13px] font-semibold text-pf-muted"
        >
          {p.seeMoreLabel}
          <MaskIcon src="/app/profile/icon-see-more-chevron.svg" width={16} />
        </Link>
      ) : null}
      {p.footer}
    </div>
  );
}
