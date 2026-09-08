import MaskIcon from "@/components/app/MaskIcon";
import type { FriendRowVM } from "@/domain/member";

export interface SuggestedFriendsProps {
  heading: string;
  rows: FriendRowVM[];
  addLabel: string;
  addedLabel: string;
  onAdd: (row: FriendRowVM) => void;
  empty: string;
}

/** Figma desktop profile right column (987:5569): "Suggested Friends" card with Add buttons. */
export default function SuggestedFriends(p: SuggestedFriendsProps) {
  return (
    <section className="flex flex-col gap-[16px] rounded-[16px] border border-pf-border bg-pf-surface p-[20px]">
      <h2 className="text-[16px] font-bold leading-[19px] text-pf-text">{p.heading}</h2>
      {p.rows.length === 0 ? (
        <p className="text-[13px] text-pf-muted">{p.empty}</p>
      ) : (
        <ul className="flex flex-col gap-[12px]">
          {p.rows.map((r) => (
            <li key={r.userId} className="flex items-center justify-between py-[8px]">
              <span className="flex items-center gap-[10px]">
                <span className="block size-[36px] overflow-hidden rounded-[18px] bg-pf-surface-2">
                  {r.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.avatarUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center text-pf-muted">
                      <MaskIcon name="people" width={16} />
                    </span>
                  )}
                </span>
                <span className="flex flex-col gap-[2px]">
                  <span className="text-[13px] font-bold leading-[16px] text-pf-text">
                    {r.displayName}
                  </span>
                  {r.handle && (
                    <span className="text-[11px] leading-[13px] text-pf-muted">{r.handle}</span>
                  )}
                </span>
              </span>
              <button
                type="button"
                onClick={() => p.onAdd(r)}
                disabled={r.busy}
                aria-pressed={r.isFollowing}
                className="rounded-[6px] bg-[#1f2937] px-[10px] py-[4px] text-[11px] font-bold text-kink-gold-bright disabled:opacity-60"
              >
                {r.isFollowing ? p.addedLabel : p.addLabel}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
