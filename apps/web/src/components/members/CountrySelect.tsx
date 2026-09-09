import Image from "next/image";
import Link from "next/link";
import MaskIcon from "@/components/app/MaskIcon";
import type { CountryRowVM } from "@/domain/member";
import MembersSearch from "./MembersSearch";

export interface CountrySelectProps {
  title: string;
  subtitle: string;
  search: { value: string; onChange: (v: string) => void; placeholder: string; label: string };
  heading: string;
  rows: CountryRowVM[];
  noResults: string | null;
  error: string | null;
  banner: { title: string; body: string; badge: string };
  comingSoonLabel: string;
}

/** "Select a Country" — Figma 881:730/763 (mobile) and 881:799/849 (PC). */
export default function CountrySelect({
  title,
  subtitle,
  search,
  heading,
  rows,
  noResults,
  error,
  banner,
  comingSoonLabel,
}: CountrySelectProps) {
  const row = (r: CountryRowVM) => (
    <>
      <span className="grid w-[24px] shrink-0 place-items-center lg:w-[36px]">
        {r.flag ? (
          <Image
            src={r.flag}
            alt=""
            width={36}
            height={22}
            className="h-[15px] w-[24px] lg:h-[22px] lg:w-[36px]"
          />
        ) : (
          <span className="text-[18px] leading-none lg:text-[26px]" aria-hidden>
            {r.emoji}
          </span>
        )}
      </span>
      <span className="truncate pl-[11px] text-[14px] font-bold text-mem-text lg:pl-[27px] lg:text-[24px] lg:font-medium">
        {r.name}
      </span>
      {r.comingSoon ? (
        <span className="ml-auto grid h-[19px] w-[78px] shrink-0 place-items-center rounded-[5px] bg-kink-gold-bright text-[9px] font-semibold text-black lg:h-[30px] lg:w-[161px] lg:text-[16px]">
          {comingSoonLabel}
        </span>
      ) : (
        <span className="ml-auto grid h-[18px] w-[101px] shrink-0 place-items-center rounded-[50px] border-[0.5px] border-mem-pill-border bg-mem-pill-bg text-[12px] font-semibold text-mem-pill-text lg:h-[34px] lg:w-[161px] lg:text-[18px]">
          {r.membersLabel ?? "…"}
        </span>
      )}
      <span className="ml-[12px] text-mem-chevron lg:ml-[34px]">
        <span className="lg:hidden">
          <MaskIcon name="chevron-right" width={13} />
        </span>
        <span className="hidden lg:block">
          <MaskIcon name="chevron-right-24" width={24} />
        </span>
      </span>
    </>
  );
  const rowClass =
    "flex h-[43px] w-full items-center rounded-[8px] border border-mem-row-border bg-mem-row px-[16px] lg:h-[64px] lg:rounded-[12px] lg:pl-[36px] lg:pr-[26px]";
  return (
    <div className="flex w-full flex-1 flex-col px-[18px] lg:max-w-[887px] lg:px-0">
      <h1 className="pt-[33px] text-[32px] font-bold leading-[38px] text-mem-title lg:pt-[78px] lg:text-[48px] lg:leading-[63px]">
        {title}
      </h1>
      <p className="max-w-[303px] pt-[9px] text-[14px] font-medium leading-[16px] text-mem-subtitle lg:max-w-[632px] lg:pt-0 lg:text-[24px] lg:leading-[29px]">
        {subtitle}
      </p>
      <div className="pt-[24px] lg:pt-[31px]">
        <MembersSearch {...search} />
      </div>
      <p className="pt-[29px] text-[14px] font-extrabold uppercase leading-[17px] text-kink-gold-bright lg:pt-[43px] lg:text-[32px] lg:leading-[40px]">
        {heading}
      </p>
      <ul className="flex flex-col gap-[8px] pt-[17px] lg:gap-[16px] lg:pt-[20px]">
        {rows.map((r) => (
          <li key={r.code}>
            {r.href ? (
              <Link href={r.href} className={rowClass}>
                {row(r)}
              </Link>
            ) : (
              <div className={`${rowClass} opacity-90`} aria-disabled="true">
                {row(r)}
              </div>
            )}
          </li>
        ))}
      </ul>
      {noResults && (
        <p className="pt-[16px] text-[14px] text-mem-muted lg:text-[20px]">{noResults}</p>
      )}
      {error && <p className="pt-[16px] text-[14px] text-mem-muted lg:text-[20px]">{error}</p>}

      <div className="mb-[27px] mt-auto flex h-[59px] items-center rounded-[8px] bg-mem-card pl-[18px] pr-[18px] pt-[1px] lg:mb-[36px] lg:h-[92px] lg:rounded-[30px] lg:pl-[36px] lg:pr-[44px]">
        <span className="relative size-[24px] shrink-0 lg:size-[45px]">
          {/* Figma's globe is two-tone (gold + white): use the export in dark mode, a themed mask in light. */}
          <Image
            src="/app/members/icon-globe.svg"
            alt=""
            width={45}
            height={45}
            className="hidden size-[24px] lg:size-[45px] dark:block"
          />
          <span className="text-mem-text dark:hidden">
            <span className="lg:hidden">
              <MaskIcon name="globe" width={24} />
            </span>
            <span className="hidden lg:block">
              <MaskIcon name="globe" width={45} />
            </span>
          </span>
        </span>
        <div className="min-w-0 pl-[12px] lg:pl-[31px]">
          <p className="text-[12px] font-bold leading-[15px] text-mem-title lg:text-[24px] lg:leading-[29px]">
            {banner.title}
          </p>
          <p className="text-[11px] font-medium leading-[13px] text-mem-subtitle lg:pt-[4px] lg:text-[22px] lg:leading-[27px]">
            {banner.body}
          </p>
        </div>
        <span className="ml-auto grid h-[19px] w-[78px] shrink-0 place-items-center rounded-[5px] bg-kink-gold-bright text-[9px] font-semibold text-black lg:h-[30px] lg:w-[161px] lg:text-[16px]">
          {banner.badge}
        </span>
      </div>
    </div>
  );
}
