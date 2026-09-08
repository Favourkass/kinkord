"use client";

import { useParams } from "next/navigation";
import AppShell from "@/components/app/AppShell";
import AboutTab from "@/components/members/AboutTab";
import EmptyTab from "@/components/members/EmptyTab";
import ProfileHeader from "@/components/members/ProfileHeader";
import ProfileTabs from "@/components/members/ProfileTabs";
import { MEMBERS_COPY } from "@/constants/members";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { useHomePresenter } from "@/presenters/useHomePresenter";
import { useMemberProfilePresenter } from "@/presenters/useMemberProfilePresenter";

export default function MemberProfilePage() {
  const params = useParams<{ username: string }>();
  const shell = useHomePresenter();
  const nav = getAppShellNav();
  const vm = useMemberProfilePresenter(params.username);

  const content = () => {
    if (vm.notFound || vm.error) {
      return (
        <p className="pt-[40px] text-center text-[15px] font-semibold text-app-subtle">
          {vm.notFound ?? vm.error}
        </p>
      );
    }
    if (vm.loading || !vm.vm) {
      return (
        <p className="pt-[40px] text-center text-[14px] text-app-subtle">
          {MEMBERS_COPY.common.loading}
        </p>
      );
    }
    return (
      <>
        <ProfileHeader
          vm={vm.vm}
          presenceText={vm.presenceText}
          labels={vm.headerLabels}
          messageHref={vm.messageHref}
          editHref={vm.editHref}
          onToggleFollow={vm.toggleFollow}
          followBusy={vm.followBusy}
        />
        <ProfileTabs tabs={vm.tabs} active={vm.tab} onSelect={vm.setTab} />
        {vm.tab === "about" ? (
          <AboutTab vm={vm.vm} labels={vm.aboutLabels} />
        ) : (
          <EmptyTab title={vm.emptyCopy[vm.tab].title} body={vm.emptyCopy[vm.tab].body} />
        )}
      </>
    );
  };

  return (
    <AppShell
      brand="KINKORD"
      tagline="THE WORLD'S KINK COMMUNITY"
      greeting={shell.greeting}
      name={shell.name}
      handle={shell.handle}
      avatarUrl={shell.avatarUrl}
      membersCount={shell.membersCount}
      activeNav="members"
      drawerOpen={shell.drawerOpen}
      onMenu={shell.openDrawer}
      onCloseDrawer={shell.closeDrawer}
      onLogout={shell.logout}
      links={nav.links}
      labels={nav.labels}
    >
      {content()}
    </AppShell>
  );
}
