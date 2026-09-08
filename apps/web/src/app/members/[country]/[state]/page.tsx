"use client";

import { useParams } from "next/navigation";
import DirectoryPage from "@/components/members/DirectoryPage";
import InfiniteSentinel from "@/components/members/InfiniteSentinel";
import KinksterCard from "@/components/members/KinksterCard";
import RegionSelector from "@/components/members/RegionSelector";
import { useMembersRegionPresenter } from "@/presenters/useMembersRegionPresenter";

export default function MembersRegionPage() {
  const params = useParams<{ country: string; state: string }>();
  const vm = useMembersRegionPresenter(params.country, params.state);

  return (
    <DirectoryPage header={vm.header}>
      <h1 className="text-[26px] font-bold leading-tight text-app-text">{vm.title}</h1>
      <p className="pt-[2px] text-[13px] text-app-subtle">{vm.subtitle}</p>

      {vm.unknownState ? (
        <p className="pt-[28px] text-center text-[15px] text-app-subtle">{vm.unknownState}</p>
      ) : (
        <>
          <div className="pt-[16px]">
            <RegionSelector {...vm.selector} />
          </div>
          <h2 className="pb-[10px] pt-[20px] text-[16px] font-bold text-app-text">{vm.heading}</h2>

          {vm.error && (
            <p className="pb-[12px] text-center text-[14px] text-app-subtle">{vm.error}</p>
          )}
          {vm.empty && (
            <p className="pt-[20px] text-center text-[14px] text-app-subtle">{vm.empty}</p>
          )}

          <ul className="flex flex-col gap-[10px]">
            {vm.rows.map((row) => (
              <li key={row.card.userId}>
                <KinksterCard
                  vm={row.card}
                  href={row.href}
                  labels={{ ...vm.cardLabels, openProfile: row.openProfileLabel }}
                  onToggleFollow={() => vm.toggleFollow(row.card)}
                  busy={row.busy}
                />
              </li>
            ))}
          </ul>

          <InfiniteSentinel
            onVisible={vm.loadMore}
            enabled={vm.hasMore && !vm.loading}
            loading={vm.loading || vm.loadingMore}
            loadingText={vm.loadingMoreText}
            endText={vm.endText}
          />
        </>
      )}
    </DirectoryPage>
  );
}
