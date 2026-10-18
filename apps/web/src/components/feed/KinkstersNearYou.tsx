import TeamBadge from "@/components/app/TeamBadge";
import Link from "next/link";
import { Mars, Target, UserRound, Venus, X } from "lucide-react";
import MaskIcon from "@/components/app/MaskIcon";
import OrganizationBadge from "@/components/organization/OrganizationBadge";
import type { FeedSuggestionVM, SuggestionSegmentVM, SuggestionShow } from "@/domain/post";

export interface KinkstersNearYouLabels {
  follow: string;
  following: string;
  remove: string;
  online: string;
  lookingFor: string;
  loading: string;
  empty: string;
  organization: string;
  verifiedOrganization: string;
}

export interface KinkstersNearYouProps {
  heading: string;
  people: FeedSuggestionVM[];
  /** Women | Men, with All first for members who see everyone by default. */
  segments: SuggestionSegmentVM[];
  segmentsLabel: string;
  onShow: (show: SuggestionShow) => void;
  /** Another segment's list is on its way. */
  loading: boolean;
  /** The sliders button: the members directory, where every filter is. */
  browseHref: string;
  browseLabel: string;
  onToggleFollow: (userId: string) => void;
  onRemove: (userId: string) => void;
  labels: KinkstersNearYouLabels;
  /** "row" is the mobile strip; "column" is the desktop right rail. */
  layout?: "row" | "column";
}

/**
 * "Kinksters Near You": a Women | Men toggle over a card per member — a tall
 * photo, who they are, where, their roles and what they're looking for, with
 * Follow and Remove underneath. It scrolls sideways in the phone feed and
 * stacks in the desktop rail, where there is a column to put it in.
 */
export default function KinkstersNearYou({
  heading,
  people,
  segments,
  segmentsLabel,
  onShow,
  loading,
  browseHref,
  browseLabel,
  onToggleFollow,
  onRemove,
  labels,
  layout = "row",
}: KinkstersNearYouProps) {
  // Nobody, and no segment to try instead: nothing to show.
  if (people.length === 0 && segments.length === 0) return null;
  const column = layout === "column";
  const gutter = column ? "" : "px-[25px]";
  return (
    <section
      className={
        column
          ? "rounded-[16px] border border-feed-line bg-feed-card p-[16px]"
          : "border-b border-feed-line py-[18px]"
      }
    >
      <header className={`flex items-center gap-[10px] ${gutter}`}>
        <MaskIcon src="/app/feed/icon-users.svg" width={24} className="text-app-people-icon" />
        <h2 className="flex-1 text-[16px] font-semibold text-feed-text">{heading}</h2>
        <Link
          href={browseHref}
          aria-label={browseLabel}
          title={browseLabel}
          className="text-feed-text transition-colors hover:text-app-people-icon"
        >
          <MaskIcon name="filter" width={24} />
        </Link>
      </header>

      {segments.length > 0 && (
        <div role="group" aria-label={segmentsLabel} className={`pt-[14px] ${gutter}`}>
          <div className="flex max-w-[340px] rounded-full bg-feed-field p-[4px]">
            {segments.map((segment) => (
              <button
                key={segment.value}
                type="button"
                aria-pressed={segment.selected}
                onClick={() => onShow(segment.value)}
                className={`flex h-[34px] flex-1 items-center justify-center gap-[6px] rounded-full text-[14px] font-medium transition-colors ${
                  segment.selected
                    ? "bg-kink-gold-bright text-kink-ink"
                    : "text-feed-muted hover:text-feed-text"
                }`}
              >
                {segment.value === "women" && <Venus size={16} aria-hidden />}
                {segment.value === "men" && <Mars size={16} aria-hidden />}
                {segment.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading || people.length === 0 ? (
        <p className={`pt-[14px] text-[13px] text-feed-muted ${gutter}`}>
          {loading ? labels.loading : labels.empty}
        </p>
      ) : (
        <ul
          className={
            column
              ? "flex flex-col gap-[12px] pt-[14px]"
              : "flex gap-[12px] overflow-x-auto px-[25px] pt-[14px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          }
        >
          {people.map((person) => (
            <li
              key={person.userId}
              className={`flex flex-col overflow-hidden rounded-[15px] border border-feed-line bg-feed-card ${
                column ? "" : "w-[190px] shrink-0"
              }`}
            >
              <PersonPhoto person={person} column={column} onlineLabel={labels.online} />
              <div className="flex flex-1 flex-col gap-[6px] px-[10px] pb-[12px] pt-[10px] text-[12px]">
                <p className="flex min-w-0 items-center gap-[4px] text-[15px] font-bold text-feed-text">
                  <span className="truncate">{person.displayName}</span>
                  {person.teamMember ? <TeamBadge size={18} /> : null}

                  {person.organization ? (
                    <OrganizationBadge
                      label={labels.organization}
                      verified
                      verifiedLabel={labels.verifiedOrganization}
                      markSize={14}
                    />
                  ) : null}
                </p>
                {person.details && <p className="text-feed-muted">{person.details}</p>}
                {person.roles && (
                  <p className="flex items-start gap-[6px] text-feed-text">
                    <UserRound
                      size={14}
                      aria-hidden
                      className="mt-[1px] shrink-0 text-app-people-icon"
                    />
                    <span>{person.roles}</span>
                  </p>
                )}
                {person.lookingFor && (
                  <div className="flex items-start gap-[6px]">
                    <Target
                      size={14}
                      aria-hidden
                      className="mt-[2px] shrink-0 text-app-people-icon"
                    />
                    <p>
                      <span className="block text-feed-muted">{labels.lookingFor}</span>
                      <span className="block text-feed-text">{person.lookingFor}</span>
                    </p>
                  </div>
                )}
                <div className="mt-auto flex gap-[8px] pt-[6px]">
                  <button
                    type="button"
                    onClick={() => onToggleFollow(person.userId)}
                    disabled={person.busy || !person.href}
                    aria-pressed={person.isFollowing}
                    className={`flex h-[30px] flex-1 items-center justify-center gap-[5px] rounded-full font-semibold disabled:opacity-50 ${
                      person.isFollowing
                        ? "bg-feed-chip text-feed-chip-text"
                        : "bg-kink-gold-bright text-kink-ink"
                    }`}
                  >
                    {!person.isFollowing && <MaskIcon name="person-add" width={14} />}
                    {person.isFollowing ? labels.following : labels.follow}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(person.userId)}
                    className="flex h-[30px] flex-1 items-center justify-center gap-[4px] rounded-full border border-feed-line font-semibold text-feed-text hover:border-feed-muted"
                  >
                    <X size={14} aria-hidden />
                    {labels.remove}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PersonPhoto({
  person,
  column,
  onlineLabel,
}: {
  person: FeedSuggestionVM;
  column: boolean;
  onlineLabel: string;
}) {
  const photo = (
    <span
      className={`${person.silver ? "ring-[3px] ring-inset ring-[#c6c6c6] border-[3px] border-[#c6c6c6]" : ""} relative block w-full overflow-hidden bg-feed-media ${column ? "aspect-[4/3]" : "aspect-[4/5]"}`}
    >
      {person.avatarUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not optimizable
        <img
          src={person.avatarUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      )}
      {person.online && (
        <span className="absolute left-[8px] top-[8px] flex items-center gap-[5px] rounded-full bg-kink-ink/70 px-[8px] py-[3px] text-[11px] font-medium text-kink-cream">
          <span aria-hidden className="size-[7px] rounded-full bg-app-online" />
          {onlineLabel}
        </span>
      )}
    </span>
  );
  return person.href ? (
    <Link href={person.href} aria-label={person.displayName}>
      {photo}
    </Link>
  ) : (
    photo
  );
}
