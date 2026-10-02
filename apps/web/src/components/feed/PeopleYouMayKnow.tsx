import Link from "next/link";
import MaskIcon from "@/components/app/MaskIcon";
import type { FeedSuggestionVM } from "@/domain/post";

export interface PeopleYouMayKnowProps {
  heading: string;
  people: FeedSuggestionVM[];
  addLabel: string;
  addedLabel: string;
  seeAllLabel: string;
  seeAllHref: string;
  dismissLabel: string;
  onDismiss: () => void;
  onToggleFollow: (userId: string) => void;
  /** "row" is the mobile strip; "column" is the desktop right rail. */
  layout?: "row" | "column";
}

/**
 * "People you may know" (Figma 831:169–837:222): a photo card per member with
 * Add friend / Remove underneath. It scrolls sideways in the phone feed and
 * stacks in the desktop rail, where there is a column to put it in.
 */
export default function PeopleYouMayKnow({
  heading,
  people,
  addLabel,
  addedLabel,
  seeAllLabel,
  seeAllHref,
  dismissLabel,
  onDismiss,
  onToggleFollow,
  layout = "row",
}: PeopleYouMayKnowProps) {
  if (people.length === 0) return null;
  const column = layout === "column";
  return (
    <section
      className={
        column
          ? "rounded-[16px] border border-feed-line bg-feed-card p-[16px]"
          : "border-b border-feed-line py-[18px]"
      }
    >
      <header className={`flex items-center gap-[10px] ${column ? "" : "px-[25px]"}`}>
        <MaskIcon src="/app/feed/icon-users.svg" width={24} className="text-app-people-icon" />
        <h2 className="flex-1 text-[14px] font-medium text-feed-text">{heading}</h2>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          className="text-feed-muted transition-colors hover:text-feed-text"
        >
          <MaskIcon src="/app/feed/icon-close.svg" width={18} />
        </button>
      </header>

      <ul
        className={
          column
            ? "flex flex-col gap-[12px] pt-[14px]"
            : "flex gap-[20px] overflow-x-auto px-[25px] pt-[14px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        }
      >
        {people.map((person) => (
          <li
            key={person.userId}
            className={`overflow-hidden rounded-[15px] border border-feed-line bg-feed-card ${
              column ? "" : "w-[221px] shrink-0"
            }`}
          >
            <PersonPhoto person={person} column={column} />
            <div className="px-[10px] pb-[12px] pt-[8px]">
              <p className="truncate text-[16px] font-bold text-feed-text">{person.displayName}</p>
              <div className="flex items-center gap-[13px] pt-[8px]">
                <button
                  type="button"
                  onClick={() => onToggleFollow(person.userId)}
                  disabled={person.busy || !person.href}
                  aria-pressed={person.isFollowing}
                  className={`flex h-[23px] flex-1 items-center justify-center gap-[6px] rounded-[5px] text-[12px] font-medium disabled:opacity-50 ${
                    person.isFollowing
                      ? "bg-feed-chip text-feed-chip-text"
                      : "bg-kink-gold-bright text-kink-ink"
                  }`}
                >
                  {!person.isFollowing && <MaskIcon name="person-add" width={15} />}
                  {person.isFollowing ? addedLabel : addLabel}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Link
        href={seeAllHref}
        className={`mt-[14px] flex items-center justify-center gap-[6px] text-[14px] font-medium text-feed-muted hover:underline ${
          column ? "" : "px-[25px]"
        }`}
      >
        {seeAllLabel}
        <MaskIcon name="chevron-right" width={17} />
      </Link>
    </section>
  );
}

function PersonPhoto({ person, column }: { person: FeedSuggestionVM; column: boolean }) {
  const photo = (
    <span
      className={`block w-full overflow-hidden bg-feed-media ${column ? "aspect-[16/9]" : "h-[191px]"}`}
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
