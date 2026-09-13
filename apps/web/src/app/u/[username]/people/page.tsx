"use client";

import { useParams, useSearchParams } from "next/navigation";
import InfiniteSentinel from "@/components/members/InfiniteSentinel";
import EditScreen from "@/components/profile/edit/EditScreen";
import PeopleTab from "@/components/profile/PeopleTab";
import { appShellProps, getAppShellNav } from "@/presenters/getAppShellNav";
import { useHomePresenter } from "@/presenters/useHomePresenter";
import { usePeoplePagePresenter } from "@/presenters/usePeoplePagePresenter";

/** People → "See more": the full Friends / Followers / Following / Suggested list. */
export default function MemberPeoplePage() {
  const params = useParams<{ username: string }>();
  const search = useSearchParams();
  const shell = useHomePresenter();
  const vm = usePeoplePagePresenter(params.username, search.get("tab"));

  return (
    <EditScreen
      shell={appShellProps(shell, getAppShellNav())}
      title={vm.title}
      backLabel={vm.backLabel}
      onBack={vm.back}
      loading={vm.loading}
      loadingLabel={vm.people.loadingText}
      error={vm.error}
    >
      <div className="-mx-[14px] lg:mx-0">
        <PeopleTab
          {...vm.people}
          footer={
            <InfiniteSentinel
              onVisible={vm.loadMore}
              enabled={vm.hasMore}
              loading={vm.loadingMore}
              loadingText={vm.loadingMoreText}
              endText={vm.endText}
            />
          }
        />
      </div>
    </EditScreen>
  );
}
