import type { AppNavLabels, AppNavLinks, AppTab } from "@/components/app/nav";
import type { PublicProfileVM } from "@/domain/member";
import AboutTab, { type AboutLabels } from "./AboutTab";
import MediaTab, { type MediaTabProps } from "./MediaTab";
import PeopleTab, { type PeopleTabProps } from "./PeopleTab";
import PostsTab, { type PostsTabProps } from "./PostsTab";
import ProfileHero, { type ProfileHeroLabels } from "./ProfileHero";
import type { ProfileNavBarProps } from "./ProfileNavBar";
import ProfileShell from "./ProfileShell";
import ProfileSideCard, { type ProfileSideCardLabels } from "./ProfileSideCard";
import ProfileTabs, { type ProfileTabVM } from "./ProfileTabs";
import SuggestedFriends, { type SuggestedFriendsProps } from "./SuggestedFriends";

/** Everything the profile presenters hand the screen (own profile and member profile alike). */
export interface ProfileScreenProps {
  loading: boolean;
  /** Not-found / error copy; null when the profile rendered. */
  status: string | null;
  loadingText: string;
  vm: PublicProfileVM | null;
  presenceText: string | null;
  nav: ProfileNavBarProps;
  topNav: { brand: string; searchHref: string; searchPlaceholder: string; accountLabel: string };
  tab: string;
  tabs: ProfileTabVM[];
  setTab: (key: string) => void;
  toggleFollow: () => void;
  followBusy: boolean;
  messageHref: string;
  editHref: string;
  heroLabels: ProfileHeroLabels;
  sideLabels: ProfileSideCardLabels;
  aboutLabels: AboutLabels;
  people: PeopleTabProps;
  posts: PostsTabProps;
  media: MediaTabProps;
  suggested: SuggestedFriendsProps;
  activeTab?: AppTab;
  viewerAvatarUrl: string | null;
  links: AppNavLinks;
  labels: AppNavLabels;
}

/** Profile page body shared by /profile (you) and /u/[username] (a member). */
export default function ProfileScreen(p: ProfileScreenProps) {
  const ready = !p.loading && p.vm !== null && !p.status;
  const statusBlock = (
    <p
      className={`px-[16px] pt-[40px] text-center text-pf-muted ${p.status ? "text-[15px] font-semibold" : "text-[14px]"}`}
    >
      {p.status ?? p.loadingText}
    </p>
  );
  const actions = {
    presenceText: p.presenceText,
    messageHref: p.messageHref,
    editHref: p.editHref,
    onToggleFollow: p.toggleFollow,
    followBusy: p.followBusy,
  };
  return (
    <ProfileShell
      nav={p.nav}
      topNav={{ ...p.topNav, links: p.links, labels: p.labels, viewerAvatarUrl: p.viewerAvatarUrl }}
      hero={ready && p.vm ? <ProfileHero vm={p.vm} labels={p.heroLabels} {...actions} /> : null}
      sideCard={
        ready && p.vm ? <ProfileSideCard vm={p.vm} labels={p.sideLabels} {...actions} /> : null
      }
      aside={ready ? <SuggestedFriends {...p.suggested} /> : null}
      viewerAvatarUrl={p.viewerAvatarUrl}
      activeTab={p.activeTab}
      links={p.links}
      labels={p.labels}
    >
      {ready && p.vm ? (
        <>
          <ProfileTabs tabs={p.tabs} active={p.tab} onSelect={p.setTab} />
          {p.tab === "about" && <AboutTab vm={p.vm} labels={p.aboutLabels} />}
          {p.tab === "people" && <PeopleTab {...p.people} />}
          {p.tab === "posts" && <PostsTab {...p.posts} />}
          {p.tab === "media" && <MediaTab {...p.media} />}
        </>
      ) : (
        statusBlock
      )}
    </ProfileShell>
  );
}
