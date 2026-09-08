"use client";

import Image from "next/image";
import DirectoryPage from "@/components/members/DirectoryPage";
import DirectoryRow from "@/components/members/DirectoryRow";
import SearchField from "@/components/members/SearchField";
import { useMembersCountryPresenter } from "@/presenters/useMembersCountryPresenter";

export default function MembersCountryPage() {
  const vm = useMembersCountryPresenter();

  return (
    <DirectoryPage header={vm.header}>
      <h1 className="text-[26px] font-bold text-app-text">{vm.title}</h1>
      <div className="pt-[14px]">
        <SearchField {...vm.search} />
      </div>
      <p className="pb-[8px] pt-[22px] text-[12px] font-bold uppercase tracking-[2px] text-kink-amber">
        {vm.heading}
      </p>
      <ul className="flex flex-col gap-[10px]">
        {vm.rows.map((row) => (
          <li key={row.code}>
            <DirectoryRow
              title={row.name}
              subtitle={row.subtitle}
              href={row.href}
              badge={row.badge}
              leading={
                row.flag ? (
                  <Image
                    src={row.flag}
                    alt=""
                    width={34}
                    height={24}
                    className="rounded-[3px] object-cover"
                  />
                ) : (
                  <span aria-hidden>{row.emoji}</span>
                )
              }
            />
          </li>
        ))}
      </ul>
      {vm.noResults && (
        <p className="pt-[16px] text-center text-[14px] text-app-subtle">{vm.noResults}</p>
      )}
      {vm.error && <p className="pt-[16px] text-center text-[14px] text-app-subtle">{vm.error}</p>}
    </DirectoryPage>
  );
}
