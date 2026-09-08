import MaskIcon from "@/components/app/MaskIcon";
import type { FriendRowVM } from "@/domain/member";

export interface FriendsTabProps {
  heading: string;
  /** Desktop header ("Friends List" in Figma 926:1572). */
  headingDesktop: string;
  subTabs: Array<{ key: "all" | "mutual"; label: string; active: boolean }>;
  onSubTab: (key: "all" | "mutual") => void;
  rows: FriendRowVM[];
  labels: { follow: string; following: string; more: string };
  onToggleFollow: (row: FriendRowVM) => void;
  loading: boolean;
  loadingText: string;
  empty: string | null;
  error: string | null;
}

/**
 * Friends tab — Figma 926:818 (mobile: list card with sub-tabs) / 926:1572 (desktop:
 * "Friends List" header with sub-tabs on the right and a two-column grid of friend cards).
 */
export default function FriendsTab(p: FriendsTabProps) {
  const subTab = (t: FriendsTabProps["subTabs"][number]) => (
    <button
      key={t.key}
      type="button"
      role="tab"
      aria-selected={t.active}
      onClick={() => p.onSubTab(t.key)}
      className={`flex flex-col items-start gap-[6px] pb-[8px] lg:pb-0 ${
        t.active
          ? "text-[14px] font-medium text-kink-gold-bright lg:font-bold"
          : "text-[13px] font-medium text-pf-muted-2 lg:text-[14px] lg:text-pf-muted"
      }`}
    >
      {t.label}
      {t.active && (
        <span
          aria-hidden
          className="block h-[2px] w-[100px] rounded-[1px] bg-kink-gold-bright lg:w-[40px]"
        />
      )}
    </button>
  );
  const followButton = (r: FriendRowVM) => (
    <button
      type="button"
      onClick={() => p.onToggleFollow(r)}
      disabled={r.busy}
      aria-pressed={r.isFollowing}
      className={`flex items-center gap-[4px] rounded-[8px] px-[10px] py-[6px] text-[12px] font-medium disabled:opacity-60 lg:px-[16px] lg:py-[8px] lg:font-bold ${
        r.isFollowing
          ? "border border-kink-gold-bright text-kink-gold-bright lg:border-pf-border lg:text-pf-muted"
          : "bg-kink-gold-bright text-black"
      }`}
    >
      {!r.isFollowing && (
        <>
          <span className="lg:hidden">
            <MaskIcon name="user-check" width={14} />
          </span>
          <span className="hidden lg:block">
            <MaskIcon name="plus" width={12} className="text-black" />
          </span>
        </>
      )}
      {r.isFollowing && (
        <span className="lg:hidden">
          <MaskIcon name="user-check" width={14} />
        </span>
      )}
      {r.isFollowing ? p.labels.following : p.labels.follow}
    </button>
  );
  const identity = (r: FriendRowVM) => (
    <span className="flex min-w-0 items-center gap-[12px]">
      <span className="block size-[48px] shrink-0 overflow-hidden rounded-[24px] bg-pf-surface-2">
        {r.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.avatarUrl} alt="" className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-pf-muted">
            <MaskIcon name="people" width={20} />
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-[2px]">
        <span className="truncate text-[13px] font-bold leading-[16px] text-pf-text lg:text-[14px] lg:leading-[17px]">
          {r.displayName}
        </span>
        {r.handle && (
          <span className="text-[11px] leading-[13px] text-pf-muted-2 lg:text-[12px] lg:leading-[15px] lg:text-pf-muted">
            {r.handle}
          </span>
        )}
      </span>
    </span>
  );
  const status = (
    <>
      {p.loading && <p className="text-[13px] text-pf-muted">{p.loadingText}</p>}
      {p.empty && <p className="text-[13px] text-pf-muted">{p.empty}</p>}
      {p.error && <p className="text-[13px] text-pf-muted">{p.error}</p>}
    </>
  );
  return (
    <>
      {/* Mobile */}
      <div className="mx-[14px] mt-[3px] flex flex-col gap-[16px] rounded-[12px] border border-pf-border bg-pf-surface p-[16px] lg:hidden">
        <h2 className="text-[17px] font-extrabold leading-[21px] text-pf-text">{p.heading}</h2>
        <div role="tablist" className="flex items-start gap-[16px] border-b border-pf-border">
          {p.subTabs.map(subTab)}
        </div>
        <ul className="flex flex-col">
          {p.rows.map((r) => (
            <li key={r.userId} className="flex items-center justify-between py-[12px]">
              {identity(r)}
              <span className="flex items-center gap-[8px]">
                {followButton(r)}
                <span className="p-[6px] text-pf-muted-2" role="img" aria-label={p.labels.more}>
                  <MaskIcon name="more-vertical" width={16} />
                </span>
              </span>
            </li>
          ))}
        </ul>
        {status}
      </div>
      {/* Desktop */}
      <div className="hidden flex-col gap-[20px] rounded-[16px] border border-pf-border bg-pf-surface p-[24px] lg:flex">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-bold leading-[24px] text-pf-text">{p.headingDesktop}</h2>
          <div role="tablist" className="flex items-center gap-[24px]">
            {p.subTabs.map(subTab)}
          </div>
        </div>
        <ul className="grid grid-cols-1 gap-[16px] min-[1440px]:grid-cols-2">
          {p.rows.map((r) => (
            <li
              key={r.userId}
              className="flex items-center justify-between gap-[12px] rounded-[12px] border border-pf-border bg-pf-surface p-[16px]"
            >
              {identity(r)}
              <span className="shrink-0">{followButton(r)}</span>
            </li>
          ))}
        </ul>
        {status}
      </div>
    </>
  );
}
