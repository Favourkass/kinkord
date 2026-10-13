import Link from "next/link";
import AvatarCircle from "@/components/app/AvatarCircle";
import SilverCheck from "@/components/app/SilverCheck";
import OrganizationBadge from "@/components/organization/OrganizationBadge";
import type { SearchPersonVM } from "@/domain/search";

export interface SearchPeopleProps {
  /** "People" on the All tab; the People tab is its own heading. */
  heading: string | null;
  rows: Array<SearchPersonVM & { busy: boolean }>;
  loading: boolean;
  error: string | null;
  empty: string | null;
  seeAll: { label: string; onClick: () => void } | null;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onToggleFollow: (userId: string) => void;
  labels: {
    searching: string;
    follow: string;
    following: string;
    morePeople: string;
    organization: string;
    verifiedOrganization: string;
  };
}

function PersonSummary({
  person: r,
  organizationLabel,
  verifiedOrganizationLabel,
}: {
  person: SearchPersonVM;
  organizationLabel: string;
  verifiedOrganizationLabel: string;
}) {
  return (
    <>
      <AvatarCircle
        src={r.avatarUrl}
        alt={r.name}
        size={48}
        shape={r.organization ? "square" : "circle"}
      />
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-[4px] text-[15px] font-bold text-feed-text">
          <span className="truncate">{r.name}</span>
          {r.silver ? <SilverCheck size={15} /> : null}
          {r.organization ? (
            <OrganizationBadge
              label={organizationLabel}
              verified
              verifiedLabel={verifiedOrganizationLabel}
              markSize={14}
            />
          ) : null}
        </span>
        {r.handle || r.details ? (
          <span className="block truncate text-[13px] text-feed-muted">
            {[r.handle, r.details].filter(Boolean).join(" · ")}
          </span>
        ) : null}
      </span>
    </>
  );
}

/** The people a search found: photo, name and Silver badge, handle and place, and Follow. */
export default function SearchPeople(p: SearchPeopleProps) {
  const l = p.labels;
  return (
    <section className="border-b border-feed-line pb-[8px]">
      {p.heading ? (
        <h2 className="px-[18px] pb-[4px] pt-[16px] text-[17px] font-bold text-feed-text">
          {p.heading}
        </h2>
      ) : null}
      {p.loading ? (
        <p className="px-[18px] py-[16px] text-[14px] text-feed-muted">{l.searching}</p>
      ) : null}
      {p.error ? (
        <p className="px-[18px] py-[16px] text-[14px] text-feed-muted">{p.error}</p>
      ) : null}
      {p.empty ? (
        <p className="px-[18px] py-[16px] text-[14px] text-feed-muted">{p.empty}</p>
      ) : null}
      {p.rows.length > 0 ? (
        <ul>
          {p.rows.map((r) => (
            <li key={r.userId} className="flex items-center gap-[12px] px-[18px] py-[10px]">
              {r.href ? (
                <Link href={r.href} className="flex min-w-0 flex-1 items-center gap-[12px]">
                  <PersonSummary
                    person={r}
                    organizationLabel={l.organization}
                    verifiedOrganizationLabel={l.verifiedOrganization}
                  />
                </Link>
              ) : (
                <span className="flex min-w-0 flex-1 items-center gap-[12px]">
                  <PersonSummary
                    person={r}
                    organizationLabel={l.organization}
                    verifiedOrganizationLabel={l.verifiedOrganization}
                  />
                </span>
              )}
              {r.canFollow ? (
                <button
                  type="button"
                  onClick={() => p.onToggleFollow(r.userId)}
                  disabled={r.busy}
                  aria-pressed={r.isFollowing}
                  className={`h-[32px] shrink-0 rounded-[8px] px-[14px] text-[13px] font-semibold disabled:opacity-50 ${
                    r.isFollowing
                      ? "bg-feed-chip text-feed-chip-text"
                      : "bg-kink-gold-bright text-kink-ink"
                  }`}
                >
                  {r.isFollowing ? l.following : l.follow}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {p.seeAll ? (
        <button
          type="button"
          onClick={p.seeAll.onClick}
          className="mx-[18px] mb-[8px] mt-[4px] h-[38px] w-[calc(100%-36px)] rounded-[8px] bg-feed-chip text-[14px] font-semibold text-feed-chip-text"
        >
          {p.seeAll.label}
        </button>
      ) : null}
      {p.hasMore ? (
        <div className="px-[18px] py-[12px] text-center">
          <button
            type="button"
            onClick={p.onLoadMore}
            disabled={p.loadingMore}
            className="rounded-[8px] border border-feed-line px-[20px] py-[8px] text-[14px] font-medium text-feed-text disabled:opacity-50"
          >
            {p.loadingMore ? l.searching : l.morePeople}
          </button>
        </div>
      ) : null}
    </section>
  );
}
