"use client";

import { useParams } from "next/navigation";
import DirectoryPage from "@/components/members/DirectoryPage";
import DirectoryRow from "@/components/members/DirectoryRow";
import SearchField from "@/components/members/SearchField";
import { useMembersStatePresenter } from "@/presenters/useMembersStatePresenter";

export default function MembersStatesPage() {
  const params = useParams<{ country: string }>();
  const vm = useMembersStatePresenter(params.country);

  return (
    <DirectoryPage header={vm.header}>
      <div className="flex items-center gap-[12px]">
        <span className="text-[34px] leading-none" aria-hidden>
          {vm.flag}
        </span>
        <div>
          <h1 className="text-[26px] font-bold leading-tight text-app-text">{vm.title}</h1>
          <p className="text-[13px] text-app-subtle">{vm.subtitle}</p>
        </div>
      </div>

      {vm.notAvailable ? (
        <p className="pt-[28px] text-center text-[15px] text-app-subtle">{vm.notAvailable}</p>
      ) : (
        <>
          <div className="pt-[16px]">
            <SearchField {...vm.search} />
          </div>
          <ul className="flex flex-col gap-[10px] pt-[18px]">
            {vm.rows.map((row) => (
              <li key={row.state}>
                <DirectoryRow title={row.state} subtitle={row.subtitle} href={row.href} />
              </li>
            ))}
          </ul>
          {vm.noResults && (
            <p className="pt-[16px] text-center text-[14px] text-app-subtle">{vm.noResults}</p>
          )}
          {vm.error && (
            <p className="pt-[16px] text-center text-[14px] text-app-subtle">{vm.error}</p>
          )}
        </>
      )}
    </DirectoryPage>
  );
}
