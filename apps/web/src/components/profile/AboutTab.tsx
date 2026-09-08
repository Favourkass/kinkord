import MaskIcon from "@/components/app/MaskIcon";
import type { PublicProfileVM } from "@/domain/member";

export interface AboutTabLabels {
  bio: string;
  basicInfo: string;
  age: string;
  gender: string;
  orientation: string;
  relationship: string;
  bodyType: string;
  interests: string;
  lookingFor: string;
  languages: string;
  joined: string;
  notShared: string;
}

export interface AboutTabProps {
  vm: PublicProfileVM;
  labels: AboutTabLabels;
}

/**
 * About tab — Figma 948:2866 (mobile: plain sections) / 987:5468 (desktop: each section a
 * rounded card, 28px padding, 18px headings).
 */
export default function AboutTab({ vm, labels }: AboutTabProps) {
  const card =
    "flex flex-col lg:gap-[20px] lg:rounded-[20px] lg:border lg:border-pf-card-border lg:bg-pf-card lg:p-[28px]";
  const heading = (text: string) => (
    <h2 className="text-[15px] font-bold leading-[18px] text-pf-text lg:text-[18px] lg:leading-[22px] lg:tracking-[0.5px] lg:text-pf-heading">
      {text}
    </h2>
  );
  const row = (label: string, value: string | null) => (
    <div className="flex items-center justify-between border-b border-pf-border py-[12px] lg:border-pf-card-border lg:py-[14px]">
      <span className="text-[14px] leading-[17px] text-pf-muted lg:font-medium">{label}</span>
      <span className="flex items-center gap-[4px] lg:gap-[8px]">
        <span
          className={`text-[14px] font-semibold leading-[17px] ${value ? "text-pf-text lg:text-pf-heading" : "text-pf-muted"}`}
        >
          {value ?? labels.notShared}
        </span>
        <MaskIcon name="chevron-right-gray" width={24} className="text-pf-muted" />
      </span>
    </div>
  );
  const chips = (items: string[]) => (
    <ul className="flex flex-wrap gap-[8px] lg:gap-[10px]">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-[100px] border border-pf-border bg-pf-chip px-[14px] py-[6px] text-[12px] font-semibold leading-[15px] text-pf-chip-text lg:border-pf-card-border lg:bg-pf-chip-2 lg:px-[16px] lg:py-[8px] lg:text-[14px] lg:leading-[17px] lg:text-kink-gold-bright"
        >
          {item}
        </li>
      ))}
    </ul>
  );
  return (
    <div className="flex flex-col gap-[24px] px-[20px] pb-[40px] pt-[20px] lg:p-0">
      <section className={`gap-[8px] ${card}`}>
        {heading(labels.bio)}
        <p
          className={`text-[14px] leading-[1.5] lg:text-[15px] lg:leading-[1.6] ${vm.bio ? "text-pf-body lg:text-pf-muted" : "text-pf-muted"}`}
        >
          {vm.bio ?? labels.notShared}
        </p>
      </section>
      <section className={card}>
        {heading(labels.basicInfo)}
        <div className="flex flex-col">
          {row(labels.age, vm.basic.age)}
          {row(labels.gender, vm.basic.gender)}
          {row(labels.orientation, vm.basic.orientation)}
          {row(labels.relationship, vm.basic.relationshipStatus)}
          {row(labels.bodyType, vm.basic.bodyType)}
        </div>
      </section>
      {vm.interests.length > 0 && (
        <section className={`gap-[10px] ${card}`}>
          {heading(labels.interests)}
          {chips(vm.interests)}
        </section>
      )}
      {vm.lookingFor.length > 0 && (
        <section className={`gap-[10px] ${card}`}>
          {heading(labels.lookingFor)}
          {chips(vm.lookingFor)}
        </section>
      )}
      <section className={`gap-[12px] pt-[8px] text-[13px] leading-[16px] lg:pt-[28px] ${card}`}>
        <div className="flex items-start justify-between">
          <span className="text-pf-muted">{labels.languages}</span>
          <span className="font-semibold text-pf-text">{vm.languages ?? labels.notShared}</span>
        </div>
        <div className="flex items-start justify-between">
          <span className="text-pf-muted">{labels.joined}</span>
          <span className="font-semibold text-pf-text">{vm.joined ?? labels.notShared}</span>
        </div>
      </section>
    </div>
  );
}
