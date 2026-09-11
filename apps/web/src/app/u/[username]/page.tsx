"use client";

import { useParams, useSearchParams } from "next/navigation";
import AboutTab from "@/components/profile/AboutTab";
import FriendsTab from "@/components/profile/FriendsTab";
import MediaTab from "@/components/profile/MediaTab";
import PostsTab from "@/components/profile/PostsTab";
import ProfileHero from "@/components/profile/ProfileHero";
import ProfileShell from "@/components/profile/ProfileShell";
import ProfileSideCard from "@/components/profile/ProfileSideCard";
import ProfileTabs from "@/components/profile/ProfileTabs";
import SuggestedFriends from "@/components/profile/SuggestedFriends";
import { MEMBERS_COPY } from "@/constants/members";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { useHomePresenter } from "@/presenters/useHomePresenter";
import { useMemberProfilePresenter } from "@/presenters/useMemberProfilePresenter";

export default function MemberProfilePage() {
  const params = useParams<{ username: string }>();
  const search = useSearchParams();
  const shell = useHomePresenter();
  const nav = getAppShellNav();
  const vm = useMemberProfilePresenter(params.username, search.get("tab"));

  const status = vm.notFound ?? vm.error;
  const ready = !vm.loading && vm.vm !== null && !status;

  const statusBlock = status ? (
    <p className="px-[16px] pt-[40px] text-center text-[15px] font-semibold text-pf-muted">
      {status}
    </p>
  ) : (
    <p className="px-[16px] pt-[40px] text-center text-[14px] text-pf-muted">
      {MEMBERS_COPY.common.loading}
    </p>
  );

  return (
    <ProfileShell
      nav={vm.nav}
      topNav={{
        ...vm.topNav,
        links: nav.links,
        labels: nav.labels,
        viewerAvatarUrl: shell.avatarUrl,
      }}
      hero={
        ready && vm.vm ? (
          <ProfileHero
            vm={vm.vm}
            presenceText={vm.presenceText}
            labels={vm.heroLabels}
            messageHref={vm.messageHref}
            editHref={vm.editHref}
            onToggleFollow={vm.toggleFollow}
            followBusy={vm.followBusy}
            onSelectStatsTab={vm.onSelectStatsTab}
            onShare={vm.nav.onShare}
          />
        ) : null
      }
      sideCard={
        ready && vm.vm ? (
          <ProfileSideCard
            vm={vm.vm}
            presenceText={vm.presenceText}
            labels={vm.sideLabels}
            messageHref={vm.messageHref}
            editHref={vm.editHref}
            onToggleFollow={vm.toggleFollow}
            followBusy={vm.followBusy}
            onShare={vm.nav.onShare}
          />
        ) : null
      }
      aside={ready ? <SuggestedFriends {...vm.suggested} /> : null}
      viewerAvatarUrl={shell.avatarUrl}
      links={nav.links}
      labels={nav.labels}
    >
      {ready && vm.vm ? (
        <>
          <ProfileTabs tabs={vm.tabs} active={vm.tab} onSelect={vm.setTab} />
          {vm.tab === "about" && <AboutTab vm={vm.vm} labels={vm.aboutLabels} />}
          {vm.tab === "friends" && <FriendsTab {...vm.friends} />}
          {vm.tab === "posts" && <PostsTab {...vm.posts} />}
          {vm.tab === "media" && <MediaTab {...vm.media} />}
        </>
      ) : (
        statusBlock
      )}
    </ProfileShell>
  );
}
